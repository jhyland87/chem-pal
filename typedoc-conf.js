module.exports = {
  projectName: {
    link: true,
    style: "color: #c0f0d0;",
    beforeLinks: "&emsp;|&emsp;",
  },
  links: [
    {
      text: "GitHub repo",
      href: "https://github.com/gamtiq/wrapme",
      normal: true,
      style: "font-size: 12px; color: #cdc;",
      target: "_top",
      id: "github_link",
    },
  ],
  //style: ".tsd-page-toolbar .header__link { color: #dd0fcc; }",
  style:
    "body { font-size: 12px; } .tsd-page-toolbar .header__project { color: #00c; font-size: 1.2rem; }",
  toolbarBackground: "rgba(255, 197, 197, 0.5)",
  showGoTop: 300,
  createFile: ".nojekyll",
};
