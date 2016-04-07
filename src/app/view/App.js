import React, { Component } from 'react'
import Copy from 'app/view/Copy'
import StatTable from 'app/view/StatTable'
import Links from 'app/view/Links'
import Tags from 'app/view/Tags'

export class App extends Component {
  get allTags () {
    return this.props.tags
  }
  get tags () {
    return this.allTags.filter(t => {
      return !this.rejected[t]
    }).splice(0, 25)
  }
  constructor (props) {
    super(props)
    this.rejected = {}
  }
  onTagClick (tag) {
    if (this.rejected[tag]) {
      this.rejected[tag] = 0
    } else {
      this.rejected[tag] = 1
    }
    this.forceUpdate() // TODO
  }
  render () {
    let {tagLabels, stats} = this.props
    // console.log(tagLabels)
    return (
      <div>
        <Copy tags={this.tags} />
        <Tags tags={this.tags} tagLabels={tagLabels} onTagClick={ (tag) => this.onTagClick(tag) } />
        <Links />
        <StatTable stats={stats} tags={this.tags} />
      </div>
    )
  }
}
