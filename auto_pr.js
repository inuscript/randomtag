const fs = require("fs")
const GITHUB_ACCESS_TOKEN = process.env.GITHUB_ACCESS_TOKEN
const CIRCLE_ARTIFACTS = process.env.CIRCLE_ARTIFACTS 

const items = fs.readFileSync(`${CIRCLE_ARTIFACTS}/tags.txt`)
console.log(items)
