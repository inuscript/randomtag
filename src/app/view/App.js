import React, { Component } from 'react'
import Copy from 'app/view/Copy'
import StatTable from 'app/view/StatTable'
import Links from 'app/view/Links'
import Tags from 'app/view/Tags'

export class App extends Component {
  get allTags () {
    return this.props.hashTags.map(ht => {
      return ht.label
    })
  }
  get selectedTags () {
    return this.allTags.filter(t => {
      return !this.rejected[t]
    }).splice(0, 25)
  }
  get hashTags(){
    return this.props.hashTags.map( ht => {
      return Object.assign({}, ht, {
        selected: this.selectedTags.indexOf(ht.label) > -1
      })
    })
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
    let {stats} = this.props
    return (
      <div>
        <Copy tags={this.selectedTags} />
        <Tags selectedTags={this.selectedTags} 
          hashTags={this.hashTags} 
          onTagClick={ (tag) => this.onTagClick(tag) } />
        <Links />
        <StatTable stats={stats} tags={this.selectedTags} />
      </div>
    )
  }
}
