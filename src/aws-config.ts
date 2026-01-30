import { Amplify } from "aws-amplify";

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: "us-east-1_qj8nOIZuj",
      userPoolClientId: "1v6og8u0k8cjt7danhv9ab82at",

      loginWith: {
        email: true,
        oauth: {
          domain: "YOUR_DOMAIN_PREFIX.auth.us-east-1.amazoncognito.com",
          scopes: ["openid", "email", "profile"],
          redirectSignIn: ["http://localhost:5173/"],
          redirectSignOut: ["http://localhost:5173/"],
          responseType: "code",
        },
      },
    },
  },
});
