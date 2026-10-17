import { markNavigationStart } from '@/components/nav/nav-timing';

export function onRouterTransitionStart(url: string) {
  markNavigationStart(url);
}
