import type { AssetValue } from '@aztec/sdk';
import type { RemoteAssetsObs } from 'alt-model/top_level_context/remote_assets_obs';
import type { BridgeDataAdaptorObsCache } from './bridge_data_adaptor_cache';
import type { DefiRecipesObs } from 'alt-model/defi/recipes';
import { createMemo, Obs, Poller } from 'app/util';
import { LazyInitDeepCacheMap } from 'app/util/lazy_init_cache_map';

const POLL_INTERVAL = 5 * 60 * 1000;

export function createInteractionPresentValueObsCache(
  defiRecipesObs: DefiRecipesObs,
  adaptorObsCache: BridgeDataAdaptorObsCache,
  remoteAssetsObs: RemoteAssetsObs,
) {
  return new LazyInitDeepCacheMap(([recipeId, interactionNonce]: [string, bigint]) => {
    // The poller is memoed outside the emitter function so that its last polled time is preserved
    // beyond emitter cleanup.
    const memo = createMemo<Poller>();
    return Obs.combine([defiRecipesObs, adaptorObsCache.get(recipeId), remoteAssetsObs]).mapEmitter<
      AssetValue | undefined
    >((deps, emit) => {
      const [recipes, adaptor, assets] = deps;
      if (!adaptor || !assets || !recipes) return undefined;
      const poller = memo(() => {
        return new Poller(() => {
          adaptor.adaptor.getInteractionPresentValue(interactionNonce).then(values => {
            emit({ assetId: Number(values[0].assetId), value: values[0].amount });
          });
        }, POLL_INTERVAL);
      }, deps);
      return poller.activate();
    }, undefined);
  });
}