module.exports = {
    "env": {
        "node": true,
        "browser": true,
    },
    "extends": [
        "eslint:recommended",
        "plugin:react/recommended"
    ],
    "parserOptions": {
        "ecmaVersion": 6,
        "sourceType": "module",
        "ecmaFeatures": {
            "jsx": true
        },
    },
    "plugins": [
        "standard",
        "react"
    ],
    "rules": {
        "semi": ["error", "never"],
        "react/prop-types": ["off"],
        "react/jsx-uses-vars": 1,
        // "arrow-parens": ["off"],
        // "space-before-blocks": ["off"],
        // "space-before-function-paren": ["off"],
    }
};
