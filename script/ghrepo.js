const github = require("github-basic")

var GhRepoBranch = function(client, user, repo, branch){
  this.client = client
  this.user = user
  this.repo = repo
  this.branch = branch
}

GhRepoBranch.prototype.gitApiBase = function() {
  return `/repos/${this.user}/${this.repo}/git`
}

GhRepoBranch.prototype.refHeads = function(){
  var url = `${this.gitApiBase()}/refs/heads`
  return this.client.get(url)
}

GhRepoBranch.prototype.searchRefSha = function(name) {
  return this.refHeads().then((heads) => {
    var head = heads.find((head) => {
      return heads.ref === `refs/heads/${name}`
    })    
    return head ? head.object.sha : undefined
  })
}

GhRepoBranch.prototype.treeSha = function(){
  var pathBase = this.gitApiBase()
  var client = this.client
  return client.get(`${pathBase}/refs/heads/${this.branch}`).then((res) => {
    return client.get(`${pathBase}/commits/${res.object.sha}`)
  }).then((res) => {
    return client.get(`${pathBase}/trees/${res.tree.sha}`)
  }).then((res) => {
    return res.tree.reduce((prev, curr) => {
      prev[curr.path] = curr.sha
      return prev
    }, {})
  })
}

GhRepoBranch.prototype.blobContent = function(sha){
  return this.client.get(`${this.gitApiBase()}/blobs/${sha}`)
    .then((blob) => {
      return new Buffer(blob.content, blob.encoding).toString()
    })
}

// files -> blobs
GhRepoBranch.prototype.blobFiles = function(files){
  return this.treeSha().then((treeSha) => {
    return files.map( (file) => {
      return this.blobContent( treeSha[file.path] )
      .then((content) => {
        return { file: file, blobContent: content }
      })
    })
  }).then((promises) => {
    return Promise.all(promises)
  })
}

GhRepoBranch.prototype.filterDiffFiles = function(files){
  var pathBase = this.gitApiBase()
  var client = this.client
  return this.blobFiles(files).then((values) => {
    var filterd = values.filter((val) => {
      return val.file.content !== val.blobContent
    }).map((item) => {
      return item.file
    })
    return filterd
  })
}

GhRepoBranch.prototype.createBranch = function(branchName){
  return this.client.branch(this.user, this.repo, this.branch, branchName)
    .catch((e) => {
      var err = e.statusCode === 422 ? "Exist branch" : e
      return Promise.reject(err)
    })
}

// pr
GhRepoBranch.prototype.pullRequest = function(toBranchName, files, title) {
  return this.createBranch(toBranchName)
    .then(() => {
      return this.client.commit(this.user, this.repo, {
        branch: toBranchName,
        message: title,
        updates: files
      })
    })
    .then( (res) => {
      return this.client.pull(
        { repo: this.repo, user: this.user, branch: toBranchName},
        { repo: this.repo, user: this.user, branch: this.branch},
        { title: title }
      )
    })
}

module.exports.GhRepoBranch = GhRepoBranch