import { useCallback, useEffect, useRef, useState } from 'react';
import { useCredits } from '../credits/CreditsProvider';
import { ACCESS_PURCHASE_FAILED, AccessApiError, purchaseAccess } from '../lib/access';
import { useAccess } from './AccessProvider';

export const OFFER_CHANGED = 'Oferta s-a schimbat. Verifică noul preț.';

export type AccessPurchase = {
  /** Buys access at the offer on screen; true on success. A call while one is in flight resolves false at once. */
  purchase(): Promise<boolean>;
  pending: boolean;
  /** The last failure, in Romanian; null after a success or while a new attempt runs. */
  error: string | null;
  /** The last attempt was refused with 409 `offer_changed`: the offer on screen is the new one now. */
  offerChanged: boolean;
};

/**
 * The „Deblochează” / „Reînnoiește” action (paywall sheet, „Abonamentul meu”). On success the plan opens at once
 * (`applyPurchase`) and the bonus lands on the pill (`setBalance` floats „+100”); on `offer_changed` the new offer
 * replaces the shown one and the student is asked again — nothing is charged.
 */
export function useAccessPurchase(): AccessPurchase {
  const { offer, applyPurchase, applyOffer, refresh } = useAccess();
  const { setBalance } = useCredits();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offerChanged, setOfferChanged] = useState(false);
  // Outside the render closure: a double tap before the re-render must not send two orders.
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const purchase = useCallback(async () => {
    if (busy.current || !offer) return false;
    busy.current = true;
    setPending(true);
    setError(null);
    setOfferChanged(false);
    try {
      const r = await purchaseAccess(offer);
      // The plan and the balance are app state: applied even if the sheet closed meanwhile.
      applyPurchase(r);
      setBalance(r.balance);
      return true;
    } catch (e) {
      if (!mounted.current) return false;
      if (e instanceof AccessApiError && e.code === 'offer_changed') {
        if (e.offer) applyOffer(e.offer);
        else void refresh();
        setOfferChanged(true);
        setError(OFFER_CHANGED);
      } else {
        setError(e instanceof Error && e.message ? e.message : ACCESS_PURCHASE_FAILED);
      }
      return false;
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }, [offer, applyPurchase, applyOffer, refresh, setBalance]);

  return { purchase, pending, error, offerChanged };
}
