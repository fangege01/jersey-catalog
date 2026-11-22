import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import {
  getOrder,
  getOrderByPublicId,
  fulfillOrder,
  unfulfillOrder,
  type ShippingAddress,
  resolveInventoryException,
} from '../../../../features/orders/db';
import { getSecret } from '../../../../features/secrets/store';
import { setSetting } from '../../../../features/settings/db';
import {
  carrierCodeFor,
  fetchLabelRates,
  findTransactionForRate,
  getShipmentRates,
  parseParcelForm,
  purchaseLabel,
  type ShipFrom,
} from '../../../../features/shipping/labels.ts';
import {
  claimPurchase,
  discardLabelAttempt,
  forceDiscardLabelAttempt,
  getLabelRecord,
  isPurchaseStale,
  markLabelFailed,
  markLabelUncertain,
  recordPurchased,
  recordQuote,
  recordRefundedAttempt,
} from '../../../../features/shipping/labelStore';
import { queueNotification } from '../../../../features/email/outboxStore';
import {
  recordExternalRefund,
  syncProviderRefund,
  voidRecordedRefund,
  acknowledgeRefundReview,
  refundableCents,
  openReviewIfOverRefunded,
  getRefundByPublicId,
} from '../../../../features/refunds/db';
import { sendRefundNotice } from '../../../../features/refunds/notify';
import { getEmailProvider } from '../../../../features/email';
import { reissueGuestAccess } from '../../../../features/orders/guestAccess.ts';
import { deliverOrderNotifications } from '../../../../features/email/outbox';
import { getStoreSettings } from '../../../../features/settings/db';
import { shouldSendCustomerOrderEmail } from '../../../../features/email/orderPolicy';
import { getPaymentProvider, type PaymentMethod } from '../../../../features/payments';
import { formatPrice } from '../../../../config';
import { parseOrderOrLegacyPublicId, parsePublicId } from '../../../../features/ids/publicId';

export const prerender = false;

// POST /api/admin/orders/:id — fulfill, unfulfill, refund, or reissue the guest
// link. :id is the order public ID (ord_ or a preserved legacy shape); numeric
// row ids are not accepted.
export const POST: APIRoute = async ({ request, params, redirect }) => {
  const publicId = parseOrderOrLegacyPublicId(params.id, 'order');
  const existing = publicId ? await getOrderByPublicId(env.DB, publicId) : null;
  if (!existing) return new Response('未找到记录。', { status: 404 });
  const id = existing.id;

  const form = await request.formData();
  const action = String(form.get('_action'));
  const back = redirect(`/admin/orders/${publicId}`, 303);

  if (action === 'unfulfill') {
    await unfulfillOrder(env.DB, id);
    return back;
  }

  const fail = (msg: string) =>
    redirect(`/admin/orders/${publicId}?error=${encodeURIComponent(msg)}`, 303);
  const notice = (msg: string) =>
    redirect(`/admin/orders/${publicId}?notice=${encodeURIComponent(msg)}`, 303);
  const cents = () => {
    const raw = String(form.get('amount') ?? '').trim();
    // Merchants type dollars; everything downstream is cents.
    const n = Math.round(Number(raw) * 100);
    return Number.isFinite(n) ? n : NaN;
  };
  const admin = String(form.get('_admin') ?? '') || null;
  const note = String(form.get('note') ?? '').trim() || null;
  const reason = String(form.get('reason') ?? '').trim() || null;

  if (action === 'resolve_inventory_exception') {
    const exceptionId = parsePublicId(form.get('exception_id'), 'inventoryException');
    if (!exceptionId) return fail('无效的库存异常记录。');
    const resolved = await resolveInventoryException(env.DB, id, exceptionId);
    return resolved ? notice('库存异常已标记为核对完成。') : fail('该库存异常已处理，或不属于此订单。');
  }

  // Rotate the guest access token and email the customer the replacement link.
  // The token itself NEVER appears in admin output — the queued customer email
  // is the only delivery path. Reissue applies to settled orders with a
  // revocable registry token; anything else is refused with a reason.
  if (action === 'reissue_link') {
    if (!existing.email) {
      return fail(
        '该订单没有客户邮箱，无法发送新链接。订单记录未改动。',
      );
    }
    if (!shouldSendCustomerOrderEmail(existing.payment_method)) {
      return fail('演示订单不发送客户邮件，无法重新签发链接。');
    }
    if (!existing.public_id?.startsWith('ord_')) {
      // A legacy order's guest link IS its preserved public ID — there is no
      // registry token to rotate.
      return fail('该旧订单使用不可撤销的访客链接，无法重新签发。');
    }
    // Rotation kills every old link the instant it lands, so refuse up front
    // when no email provider could deliver the replacement — otherwise the
    // customer would lose access with nothing on the way.
    if (!(await getEmailProvider(await getStoreSettings(env.DB)))) {
      return fail(
        '邮件服务尚未配置，无法发送新链接。订单记录未改动。',
      );
    }
    // Atomic: rotates the token AND queues the versioned
    // guest-link-reissue:<generation> notification in one D1 batch; refuses
    // unsettled checkouts (and unknown registry rows).
    const reissued = await reissueGuestAccess(env.DB, existing.public_id);
    if (!reissued) {
      return fail('仅可为已结算且有访客链接的订单重新签发。');
    }
    try {
      await deliverOrderNotifications(env.DB, id, new URL(request.url).origin);
    } catch (err) {
      // The row stays queued; the piggyback sweep will retry it.
      console.error('Guest-link reissue delivery failed:', err);
    }
    return notice(
      '旧订单链接已失效，系统正在向客户发送新链接。',
    );
  }

  // Refund through the provider. Moves money.
  if (action === 'refund') {
    const order = await getOrder(env.DB, id);
    if (!order?.provider_session_id) return back;

    // Local guards first, before building a provider client: constructing one
    // throws when the rail isn't fully configured, and a request we were going
    // to reject anyway shouldn't surface as a 500 with no explanation.
    //
    // A refund already recorded by hand makes a full provider refund ambiguous:
    // we would be asking the provider for the whole total while part of it has
    // already gone back another way. The merchant should refund the remainder
    // in the provider's own dashboard, which syncs back automatically.
    if (order.external_refunded_cents > 0) {
      return fail(
        '该订单已登记过手动退款。请在支付平台退还剩余款项，结果会自动同步。',
      );
    }
    if (refundableCents(order) <= 0) return fail('该订单已全额退款。');

    try {
      // NULL predates payment_method and was always Stripe. Falling through to
      // the store's CURRENT default would send a legacy card refund at whatever
      // rail happens to be configured now.
      const provider = await getPaymentProvider(
        (order.payment_method ?? 'stripe') as PaymentMethod,
      );
      if (!provider.refund) {
        return fail(
          '此付款方式不支持自动退款。请自行退款后点击「登记退款」。',
        );
      }
      await provider.refund(order.provider_session_id);
    } catch (err) {
      console.error('Admin provider refund failed', { orderId: id, error: err });
      return fail('支付平台退款请求失败。请先在支付平台核对退款状态。');
    }
    // Absolute, not additive: the provider now holds the full total. The
    // charge.refunded webhook that follows reports the same number and is
    // therefore a no-op rather than a second refund.
    const synced = await syncProviderRefund(env.DB, {
      orderId: id,
      cumulativeRefundedCents: order.amount_total_cents,
      provider: order.payment_method ?? 'stripe',
      idempotencyKey: `admin:provider-refund:${id}:${order.amount_total_cents}`,
      reason: reason ?? 'Full refund issued from minshop',
      createdBy: admin,
    });
    // Precisely because that webhook is a no-op, it will not mail the customer
    // either — so this path has to. Whichever of the two recognises the money
    // first sends exactly one notice.
    if (synced.ok && synced.advanced) {
      await sendRefundNotice(id, synced.deltaCents, new URL(request.url).origin);
    }
    return back;
  }

  // Record money already returned outside the provider. Moves no money.
  if (action === 'record_refund') {
    const order = await getOrder(env.DB, id);
    if (!order) return fail('未找到订单。');
    const amount = cents();
    if (!Number.isFinite(amount) || amount <= 0) return fail('请输入大于零的退款金额。');

    const result = await recordExternalRefund(env.DB, {
      orderId: id,
      amountCents: amount,
      // Same order + amount + note submitted twice is a double-click, not two
      // refunds. A merchant who really means two identical refunds can add a
      // distinguishing note.
      idempotencyKey: `manual:${id}:${amount}:${note ?? ''}`,
      kind: order.payment_method === 'demo' ? 'demo' : 'manual_external',
      provider: order.payment_method,
      reason,
      note,
      createdBy: admin,
    });

    if (!result.ok) {
      if (result.reason === 'duplicate') {
        return fail('该笔退款已登记。');
      }
      if (result.reason === 'insufficient_balance') {
        return fail(
          `该金额超过剩余可退款金额（${formatPrice(refundableCents(order))}）。`,
        );
      }
      if (result.reason === 'invalid_amount') return fail('请输入大于零的退款金额。');
      return fail('该订单无法退款。');
    }
    // sendRefundNotice applies the demo rule itself, so demo orders stay silent.
    await sendRefundNotice(id, amount, new URL(request.url).origin);
    return back;
  }

  // Reconcile a refund the merchant made in the provider's own dashboard, for
  // when the webhook never arrived. Absolute: this is the provider's total.
  if (action === 'sync_refund') {
    const order = await getOrder(env.DB, id);
    if (!order) return fail('未找到订单。');
    const amount = cents();
    if (!Number.isFinite(amount) || amount < 0) return fail('请输入目前累计退款金额。');
    if (amount > order.amount_total_cents) {
      return fail('该金额超过订单总额。');
    }

    const result = await syncProviderRefund(env.DB, {
      orderId: id,
      cumulativeRefundedCents: amount,
      provider: order.payment_method ?? 'stripe',
      idempotencyKey: `admin:sync:${id}:${amount}`,
      providerRefundId: String(form.get('provider_refund_id') ?? '').trim() || null,
      reason: reason ?? 'Synced by hand from the provider dashboard',
      createdBy: admin,
    });

    if (!result.ok) return fail('该订单无法核对。');
    if (!result.advanced) {
      return fail('该退款总额已登记。');
    }
    // The provider total can be individually valid yet exceed the order once
    // added to what was recorded by hand. The generated aggregate clamps, so
    // without this the conflict would be absorbed silently — the webhook path
    // has always checked, and this path must too.
    const conflict = await openReviewIfOverRefunded(env.DB, id);
    await sendRefundNotice(id, result.deltaCents, new URL(request.url).origin);
    if (conflict) {
      return fail(
        '已登记。支付平台退款与手动登记退款的合计超出订单总额，请核对该订单的退款记录。',
      );
    }
    return back;
  }

  // Correct a mistaken manual entry. Moves no money. The form submits the
  // refund's public ID (rfnd_ or a preserved legacy UUID); resolution happens
  // here at the boundary and the ledger write stays integer.
  if (action === 'void_refund') {
    const refundPublicId = parseOrderOrLegacyPublicId(form.get('refund_id'), 'refund');
    const target = refundPublicId ? await getRefundByPublicId(env.DB, refundPublicId) : null;
    if (!target || target.order_id !== id) return fail('无效的退款记录。');
    const result = await voidRecordedRefund(env.DB, {
      refundId: target.id,
      idempotencyKey: `void:${target.id}`,
      reason,
      createdBy: admin,
    });
    if (!result.ok) {
      return fail(
        result.reason === 'duplicate'
          ? '该笔登记已作废。'
          : '只能作废手动登记的退款。',
      );
    }
    return back;
  }

  if (action === 'review_refund') {
    await acknowledgeRefundReview(env.DB, id, admin);
    return back;
  }

  /** Attempt outbox delivery of the shipped notice; true iff an email will go. */
  const queueShippedDelivery = async (orderId: number): Promise<boolean> => {
    const settings = await getStoreSettings(env.DB);
    const order = await getOrder(env.DB, orderId);
    const willEmail =
      !!order?.email &&
      shouldSendCustomerOrderEmail(order.payment_method) &&
      !!(await getEmailProvider(settings));
    if (willEmail) {
      try {
        await deliverOrderNotifications(env.DB, orderId, new URL(request.url).origin, settings);
      } catch (err) {
        // Row stays queued; the piggyback sweep retries it.
        console.error('Shipped-notification delivery failed:', err);
      }
    }
    return willEmail;
  };

  // ── Shipping labels ────────────────────────────────────────────────────────
  // Buying moves money on the merchant's Shippo account, so every step runs
  // through the shipping_labels state machine: one row per order, conditional
  // claims, and an explicit human gate for ambiguous outcomes. The shipment id
  // is NEVER taken from the request — only from this order's own row.

  if (action === 'label_discard') {
    // Quotes and definitively-failed attempts only. A SUBMITTED purchase may
    // still be completing at Shippo — only reconciliation can settle those.
    return (await discardLabelAttempt(env.DB, id))
      ? notice('已放弃该次运单购买，可重新查询运费。')
      : fail('没有可放弃的运单购买记录。已提交的购买需要先向 Shippo 核对。');
  }

  if (action === 'label_force_discard') {
    // The risk-bearing override, chosen by a human who has read what it costs:
    // deleting a submitted attempt ends the single-shot guarantee for this
    // order — if the lost request completes after all, its label will exist
    // only at Shippo. Reconciliation is always the safe path; this exists for
    // attempts whose POST plausibly never left the building.
    return (await forceDiscardLabelAttempt(env.DB, id))
      ? notice(
          'Attempt force-discarded. If the original request did reach Shippo, its label will appear only in your Shippo dashboard.',
        )
      : fail('没有可强制放弃的已提交记录。');
  }

  // Ask Shippo what actually happened to a submitted-but-unsettled attempt.
  // This is the ONLY path that reopens (proven no purchase → 'failed') or
  // durably records (found a SUCCESS transaction → same guarded completion as
  // a live purchase) an ambiguous attempt.
  if (action === 'label_reconcile') {
    const token = await getSecret(env.DB, 'shippo_api_key');
    if (!token) return fail('请先在设置中添加 Shippo API 令牌。');
    const record = await getLabelRecord(env.DB, id);
    const settleable =
      record &&
      record.claim_token &&
      record.rate_id &&
      (record.status === 'uncertain' || (record.status === 'purchasing' && isPurchaseStale(record)));
    if (!record || !settleable) {
      return fail('没有待核对的运单购买记录。');
    }

    // Provider/service/amount come from the shipment's own rate list — the
    // transaction record does not carry them.
    const rates = await getShipmentRates(token, record.shipment_id);
    const rate = rates.ok ? rates.value.find((r) => r.rateId === record.rate_id) : null;
    const outcome = await findTransactionForRate(
      token,
      record.rate_id!,
      rate?.provider ?? record.provider ?? 'Carrier',
    );
    if (!outcome.ok) return fail(`无法与 Shippo 核对：${outcome.error}`);

    if (outcome.value.state === 'pending') {
      return fail(
        'Shippo 尚未返回最终结果。运单可能仍在处理或暂未显示。请稍后重试，订单记录未改动。',
      );
    }
    if (outcome.value.state === 'refunded') {
      // Bought, then refunded at the provider: record the original transaction
      // for the audit trail; only that recording reopens quoting.
      const refFound = outcome.value.label;
      const audited = await recordRefundedAttempt(env.DB, id, record.claim_token!, {
        transactionId: refFound.transactionId,
        provider: refFound.provider,
        service: rate?.service ?? record.service ?? '',
        amountCents: rate?.amountCents ?? record.amount_cents ?? 0,
        trackingNumber: refFound.trackingNumber,
        labelUrl: refFound.labelUrl,
        carrierCode: carrierCodeFor(refFound.provider),
      });
      if (!audited) return fail('核对期间运单状态已变化，请刷新后重新检查。');
      return notice(
        `Shippo 已确认运单购买后退款（交易 ${refFound.transactionId}）。结果已登记，可重新查询运费。`,
      );
    }
    if (outcome.value.state === 'none') {
      const failed = await markLabelFailed(
        env.DB,
        id,
        record.claim_token!,
        'Reconciled with Shippo: the attempt terminated in ERROR without purchasing.',
      );
      if (!failed) {
        return fail('核对期间运单状态已变化，请刷新后重新检查。');
      }
      return notice('Shippo 已确认未购买运单，可以重新查询运费。');
    }
    const found = outcome.value.label;
    const recorded = await recordPurchased(env.DB, id, record.claim_token!, {
      transactionId: found.transactionId,
      provider: found.provider,
      service: rate?.service ?? record.service ?? '',
      amountCents: rate?.amountCents ?? record.amount_cents ?? 0,
      trackingNumber: found.trackingNumber,
      labelUrl: found.labelUrl,
      carrierCode: carrierCodeFor(found.provider),
    });
    if (!recorded.recorded) {
      return fail('核对期间运单状态已变化，请刷新后重新检查。');
    }
    if (!recorded.orderFulfilled) {
      return notice(
        `已从 Shippo 找回并登记运单 ${found.trackingNumber}。订单已退款或履约，请手动核对配送。`,
      );
    }
    await queueShippedDelivery(id);
    return notice(
      `已从 Shippo 找回并登记运单 ${found.trackingNumber}，订单已标记为履约。`,
    );
  }

  if (action === 'label_rates' || action === 'buy_label') {
    const token = await getSecret(env.DB, 'shippo_api_key');
    if (!token) return fail('请先在设置中添加 Shippo API 令牌。');
    if (!existing.ship_address) return fail('该订单没有收件地址。');
    let raw: ShippingAddress;
    try {
      raw = JSON.parse(existing.ship_address) as ShippingAddress;
    } catch {
      return fail('无法读取该订单的收件地址。');
    }
    // The snapshot's fields are nullable (provider shapes vary); a label needs
    // the essentials, so refuse with the gap named rather than 500 at Shippo.
    if (!raw.name || !raw.line1 || !raw.city || !raw.postal || !raw.country) {
      return fail(
        '收件地址不完整。购买运单需要收件人、街道、城市、邮编和国家或地区。',
      );
    }
    const shipTo = {
      name: raw.name,
      line1: raw.line1,
      line2: raw.line2,
      city: raw.city,
      state: raw.state,
      postal: raw.postal,
      country: raw.country,
      email: existing.email,
    };

    if (action === 'label_rates') {
      const from: ShipFrom = {
        name: String(form.get('from_name') ?? '').trim(),
        street1: String(form.get('from_street1') ?? '').trim(),
        city: String(form.get('from_city') ?? '').trim(),
        state: String(form.get('from_state') ?? '').trim(),
        zip: String(form.get('from_zip') ?? '').trim(),
        country: String(form.get('from_country') ?? '').trim().toUpperCase(),
      };
      if (!from.name || !from.street1 || !from.city || !from.zip || from.country.length !== 2) {
        return fail('请填写完整发件地址，国家或地区使用两位代码。');
      }
      // Domestic only, for now: an international label needs a customs
      // declaration (contents, values, phone numbers) this flow does not
      // collect, so Shippo would refuse or the parcel would stall at export.
      if (from.country !== shipTo.country.toUpperCase()) {
        return fail(
          `该订单寄往 ${shipTo.country.toUpperCase()}。请在 Shippo 控制台购买国际运单，再到此处登记物流单号。`,
        );
      }
      const settings = await getStoreSettings(env.DB);
      const parsed = parseParcelForm(
        {
          length: String(form.get('parcel_length') ?? ''),
          width: String(form.get('parcel_width') ?? ''),
          height: String(form.get('parcel_height') ?? ''),
          weight: String(form.get('parcel_weight') ?? ''),
        },
        settings.weightUnit,
      );
      if (!parsed.parcel) return fail(parsed.error ?? '请检查包裹尺寸和重量。');

      // Remember for next time regardless of whether a label gets bought.
      await setSetting(env.DB, 'ship_from', JSON.stringify(from));
      await setSetting(
        env.DB,
        'parcel_default',
        JSON.stringify({
          length: parsed.parcel.length,
          width: parsed.parcel.width,
          height: parsed.parcel.height,
        }),
      );

      const rates = await fetchLabelRates(
        token,
        from,
        shipTo,
        parsed.parcel,
        settings.weightUnit,
        existing.public_id,
      );
      if (!rates.ok) return fail(rates.error);
      // The quote binds to THIS order in D1. Refusal means a purchase is in
      // progress, done, or the order is no longer labelable (unpaid, fulfilled,
      // pickup) — nothing was charged either way.
      if (!(await recordQuote(env.DB, id, rates.value.shipmentId))) {
        return fail('当前无法查询运费。该订单已购买运单或已不符合查询条件。');
      }
      return back;
    }

    // buy_label — the claim flips this order's quote to 'purchasing'; exactly
    // one concurrent submit wins, and the shipment bought from is the row's.
    const rateId = String(form.get('rate') ?? '').trim();
    if (!rateId) return fail('请先选择一项运费报价。');
    const claim = await claimPurchase(env.DB, id, rateId);
    if (!claim) {
      return fail('当前没有可购买的报价。请先查询运费，或等待正在进行的购买完成。');
    }
    const rates = await getShipmentRates(token, claim.shipmentId);
    if (!rates.ok) {
      await markLabelFailed(env.DB, id, claim.claimToken, rates.error);
      return fail(rates.error);
    }
    const rate = rates.value.find((r) => r.rateId === rateId);
    if (!rate) {
      await markLabelFailed(env.DB, id, claim.claimToken, 'Selected rate no longer offered.');
      return fail('原报价已失效，请重新查询运费。');
    }

    const bought = await purchaseLabel(token, rate.rateId, rate.provider, existing.public_id);
    if (!bought.ok) {
      if (bought.uncertain) {
        // The charge MAY have landed. Park it — never auto-retry a purchase —
        // and point the merchant at the dashboard record (tagged with the
        // order id via metadata) before they explicitly discard.
        await markLabelUncertain(env.DB, id, claim.claimToken, bought.error);
        return fail(
          `购买运单时未收到 Shippo 的确认。运单可能已购买，请先在本订单中与 Shippo 核对。`,
        );
      }
      await markLabelFailed(env.DB, id, claim.claimToken, bought.error);
      return fail(bought.error);
    }

    // One batch: label row, guarded fulfillment, label URL, and the durable
    // shipped-notification row. A crash after the charge can no longer leave a
    // paid label unrecorded, and the email survives via the outbox sweep.
    const recorded = await recordPurchased(env.DB, id, claim.claimToken, {
      transactionId: bought.value.transactionId,
      provider: rate.provider,
      service: rate.service,
      amountCents: rate.amountCents,
      trackingNumber: bought.value.trackingNumber,
      labelUrl: bought.value.labelUrl,
      carrierCode: carrierCodeFor(bought.value.provider),
    });
    if (!recorded.recorded) {
      // This attempt was superseded (its lease expired and it was discarded)
      // while Shippo processed it — the label exists ONLY at Shippo. Nothing
      // here was touched, by design; the charge still needs human eyes.
      return fail(
        `此前放弃的请求已购买运单（${bought.value.trackingNumber}），但未登记到订单。请在 Shippo 控制台核对订单 ${existing.public_id}。`,
      );
    }
    if (!recorded.orderFulfilled) {
      // The charge is real and saved, but the order refused fulfillment — it
      // was refunded or otherwise changed state while the provider call was in
      // flight. No shipped email was queued. Say so — pretending this
      // succeeded is how paid labels get lost.
      return fail(
        `运单 ${bought.value.trackingNumber} 已购买并保存。由于订单状态发生变化，系统未标记履约或发送邮件，请手动核对。`,
      );
    }
    const willEmail = await queueShippedDelivery(id);
    return notice(
      `已购买运单（${rate.provider} ${rate.service}），已登记物流单号 ${bought.value.trackingNumber}。 ${
        willEmail
          ? '物流通知邮件已加入发送队列。'
          : '由于是演示订单、缺少客户邮箱或邮件服务未配置，系统不会发送邮件。'
      }`,
    );
  }

  // Fulfill
  const carrier = String(form.get('carrier') ?? '').trim() || null;
  const trackingNumber = String(form.get('tracking_number') ?? '').trim() || null;
  if (!(await fulfillOrder(env.DB, id, carrier, trackingNumber))) {
    return fail(
      '该订单有正在购买或待核对的运单，请先处理该记录。',
    );
  }

  // Durable shipped notice: queue + attempt now; a failed send is retried by
  // the outbox sweep instead of vanishing into a log line. Demo orders and
  // orders without an email are marked skipped by the deliverer itself.
  await queueNotification(env.DB, id, 'order-shipped');
  try {
    await deliverOrderNotifications(env.DB, id, new URL(request.url).origin);
  } catch (err) {
    console.error('Shipped-notification delivery failed:', err);
  }

  return back;
};
