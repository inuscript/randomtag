
var promiseTreeSha = function(branch){
  return client.get(`/repos/${user}/${repo}/git/refs/heads/${branch}`).then((res) => {
    return client.get(`/repos/${user}/${repo}/git/commits/${res.object.sha}`)
  }).then((res) => {
    return client.get(`/repos/${user}/${repo}/git/trees/${res.tree.sha}`)
  }).then((res) => {
    return res.tree.reduce((prev, curr) => {
      prev[curr.path] = curr.sha
      return prev
    }, {})
  }).catch((err) => {
    console.log(err)
  })
}

promiseTreeSha(fromBranch).done((treeSha) => {
  var fileShaPromise = files.map( (file) => {
    var sha = treeSha[file.path]
    return client.get(`/repos/${user}/${repo}/git/blobs/${sha}`)
    .then((res) => {
      return {
        path: file.path,
        content: file.content,
        treeContent: new Buffer(res.content, res.encoding).toString()
      }
    })
  })
  Promise.all(fileShaPromise)
    .then((values) => {
      var filterd = values.filter((val) => {
        return val.content !== val.treeContent
      }).map((file) => {
        return {
          path: file.path,
          content: file.content
        }
      })
      console.log(filterd)
      return filterd
    })
    // .done((files) => {
    //   console.log(files)
    // })
})