import { DefaultPolicies, type PolicyConfig } from "repopo";

const config: PolicyConfig = {
	policies: [...DefaultPolicies],
	policySettings: {
		PackageJsonProperties: {
			verbatim: {
				license: "MIT",
				author: "Tyler Butler <tyler@tylerbutler.com>",
				bugs: "https://github.com/tylerbutler/xkcd2-nitro/issues",
			},
		},
	},
};

export default config;
