module.exports = {
    // "env": {
    //     "jsx": true
    // },
    "extends": "eslint:recommended",
    "parserOptions": {
        "ecmaVersion": 6,
        "ecmaFeatures": {
            jsx: true
        },
        "sourceType": "module",
    },
    "plugins": [
        "standard"
    ],
    "rules": {
        "semi": ["error", "never"],
        // "arrow-parens": ["off"],
        // "space-before-blocks": ["off"],
        // "space-before-function-paren": ["off"],
    }
};
