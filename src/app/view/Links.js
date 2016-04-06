import React from 'react'

export default function() {
  let base = 'https://github.com/inuscript/dogtag'
  let issue = `${base}/issues/new?body=${base}/edit/gh-pages/tags.txt`
  let edit = `${base}/edit/master/tags.txt`
  return <div><a href={issue}>Issue</a><a href={edit}>Edit</a></div>
}