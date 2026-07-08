declare global {
  type Contributor = {
    name: string;
    url: string;
    role: string;
    email: string;
  };
  type Bugs = {
    url: string;
    email?: string;
  };
  type Links = {
    [key: string]: string;
  };
  type Config = Record<string, unknown>;
}

declare const __APP_CONTRIBUTORS__: Contributor[];
declare const __APP_HOMEPAGE__: string;
declare const __APP_VERSION__: string;
declare const __APP_WIKI__: string;
declare const __APP_BUGS__: string;
declare const __APP_REPOSITORY__: string;
declare const __APP_CONFIG__: Config;
declare const __GITHUB_OWNER__: string;
declare const __GITHUB_REPO__: string;
