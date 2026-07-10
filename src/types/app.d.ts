declare global {
  /** A project contributor, as listed in `package.json`'s `contributors` array. */
  type Contributor = {
    /** Contributor's display name. */
    name: string;
    /** Link to the contributor (profile, site, etc.). */
    url: string;
    /** Contributor's role on the project (e.g. "author", "maintainer"). */
    role: string;
    /** Contributor's contact email. */
    email: string;
  };
  /** Bug-tracker details, mirroring `package.json`'s `bugs` field. */
  type Bugs = {
    /** URL of the issue tracker. */
    url: string;
    /** Optional contact email for reporting bugs. */
    email?: string;
  };
  /** A flat map of named links (e.g. wiki, docs), keyed by link name. */
  type Links = {
    [key: string]: string;
  };
}

// Build-time constants injected by Vite's `define` (see tools/buildDefines.js), sourced from
// `package.json` and inlined at compile time so they resolve identically in the app and tests.
// This block must stay in sync with the keys returned by `buildDefines`.

/** True in the `aggregate` build mode; gates capturing supplier responses for fixtures. */
declare const __RESPONSE_AGGREGATE__: boolean;
/** App package name, from `package.json` `name`. */
declare const __APP_NAME__: string;
/** Current app version, from `package.json` `version`. */
declare const __APP_VERSION__: string;
/** Source repository URL, from `package.json` `repository.url`. */
declare const __APP_REPOSITORY__: string;
/** Project homepage URL, from `package.json` `homepage`. */
declare const __APP_HOMEPAGE__: string;
/** Wiki URL, from `package.json` `config.links.wiki`. */
declare const __APP_WIKI__: string;
/** Privacy policy URL, from `package.json` `config.links.privacy`. */
declare const __APP_PRIVACY__: string;
/** Bug-tracker URL, from `package.json` `bugs.url`. */
declare const __APP_BUGS__: string;
/** Project contributors, from `package.json` `contributors`. */
declare const __APP_CONTRIBUTORS__: Contributor[];
/** GitHub repository owner, from `package.json` `config.github.owner`. */
declare const __GITHUB_OWNER__: string;
/** GitHub repository name, from `package.json` `config.github.repo`. */
declare const __GITHUB_REPO__: string;
