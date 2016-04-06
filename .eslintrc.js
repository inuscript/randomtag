module.exports = {
    "env": {
        "node": true,
        "browser": true,
    },
    "extends": "eslint:recommended",
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
        // "arrow-parens": ["off"],
        // "space-before-blocks": ["off"],
        // "space-before-function-paren": ["off"],
    }
};
