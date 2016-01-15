const github = require("github-basic")

var GhRepo = function(user, repo, token){
  this.user = user
  this.repo = repo
  this.client = github({version: 3, auth: token})
}

GhRepo.prototype.gitApiBase = () => {
  return `/repos/${user}/${repo}/git`
}

GhRepo.prototype.refHeads = () => {
  return this.client.get(`${this.gitApiBase()}/refs/heads`)
}

GhRepo.prototype.searchRefSha = (name) => {
  return this.refHeads().then((heads) => {
    var head = heads.find((head) => {
      return heads.ref === name
    })
    return head ? head.object.sha : undefined
  })
}

GhRepo.prototype.touchBranch = (fromBranch, toBranch) => {
  var fromBranch = fromBranch || "master"

  return new Promise((resolve, reject) => {
    this.searchRefSha(toBranch).then((sha) => {
      if(isExist) return resolve(sha)
      this.client.branch(this.user, this.repo, fromBranch, toBranch, (err, res) => {
        console.log(res)
        return resolve(res)
      })
    })
  })
}

GhRepo.prototype.treeSha = function(branch){
  var pathBase = this.gitApiBase()
  return client.get(`${pathBase}/refs/heads/${branch}`).then((res) => {
    return client.get(`${pathBase}/commits/${res.object.sha}`)
  }).then((res) => {
    return client.get(`${pathBase}/trees/${res.tree.sha}`)
  }).then((res) => {
    return res.tree.reduce((prev, curr) => {
      prev[curr.path] = curr.sha
      return prev
    }, {})
  }).catch((err) => {
    console.log(err)
  })
}

GhRepo.prototype.pullRequest = (fromBranch, toBranch) => {
  var title = message =  `Auto build ${CIRCLE_BUILD_NUM}`
  return this.touchBranch(fromBranch, toBranch)
  .then(() => {
    var option = {
      branch: branchName,
      message: message,
      updates: files
    }
    return client.commit(user, repo, option)
  })
  .then( (res) => {
    return client.pull(
      { repo: this.repo, user: this.user, branch: branchName},
      { repo: this.repo, user: this.user, branch: fromBranch},
      { title: title }
    )
  })
}

module.exports.GhRepo = GhRepo