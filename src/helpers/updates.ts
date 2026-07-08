import semver from "semver";
/**
 * Checks for updates from the GitHub API.
 * @returns The latest release data.
 */
export const getLatestRelease = async () => {
  const response = await fetch(
    `https://api.github.com/repos/${__GITHUB_OWNER__}/${__GITHUB_REPO__}/releases/latest`,
  );
  const data = await response.json();
  console.log("UPDATE DATA:", data);
  return data;
};

/**
 * Checks if an update is available.
 * @returns True if an update is available, false otherwise.
 */
export const isUpdateAvailable = async (): Promise<boolean> => {
  const latestRelease = await getLatestRelease();
  return semver.satisfies(__APP_VERSION__, latestRelease.tag_name);
};
