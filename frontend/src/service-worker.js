import * as navigationPreload from 'workbox-navigation-preload';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';
import { registerRoute, NavigationRoute, Route } from 'workbox-routing';
import { precacheAndRoute } from 'workbox-precaching';

precacheAndRoute(self.__WB_MANIFEST);

navigationPreload.enable();

const navigationRoute = new NavigationRoute(new NetworkFirst({
    cacheName: 'navigations'
}));

registerRoute(navigationRoute);

const staticAssetsRoute = new Route(({ request }) => {
    return ['image', 'script', 'style'].includes(request.destination);
}, new CacheFirst({
    cacheName: 'static-assets'
}));

registerRoute(staticAssetsRoute);
