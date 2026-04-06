import type { GatsbyNode } from "gatsby";

const legacyRedirects = [
  {
    fromPath: "/2023/10/18/how-to-use-creative-ilks-baby-monitor-on-a-cellular-hotspot-a-step-by-step-guide/",
    toPath: "/blog/how-to/cellular-hotspot/",
  },
  {
    fromPath: "/2023/10/18/how-to-use-creative-ilks-baby-monitor-on-a-cellular-hotspot-a-step-by-step-guide",
    toPath: "/blog/how-to/cellular-hotspot/",
  },
];

export const createPages: GatsbyNode["createPages"] = async ({ actions }) => {
  for (const redirect of legacyRedirects) {
    actions.createRedirect({
      ...redirect,
      isPermanent: true,
      redirectInBrowser: true,
    });
  }
};
