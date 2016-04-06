import Clipboard from 'clipboard'
import React, { Component } from 'react'
import { round } from 'mathjs'
import cx from 'classnames'

class CopyButton extends Component {
  render () {
    let {target} = this.props
    let id = '__copy__button__'
    this.clipboard = new Clipboard(`#${id}`)
    return <button id={id} data-clipboard-target={target} >Copy !</button>
  }
}

class Tag extends Component {
  render () {
    let {tag, onClick, tagLabel} = this.props
    // なぜか最後に空白が無いとcssが崩れる。謎。
    return <span className='tag-item' onClick={ () => onClick(tag)}>
      <span className='tag-label'>{`#${tag} `}</span>
    </span>
  }
}

class Tags extends Component {
  render () {
    let { tags, onTagClick } = this.props
    return <div>{
      tags.map((tag,i) => <Tag key={i} tag={tag} onClick={ () => onTagClick(tag) } />)
    }</div>
  }
}

class CopyTags extends Component {
  render () {
    let { tags, id } = this.props
    let copyStrings = tags.map((tag) => `#${tag}`).join(' ')
    return <div id={id} className='copy-tag'>{copyStrings}</div>
  }
}

class Links extends Component {
  render () {
    let base = 'https://github.com/inuscript/dogtag'
    let issue = `${base}/issues/new?body=${base}/edit/gh-pages/tags.txt`
    let edit = `${base}/edit/master/tags.txt`
    return <div><a href={issue}>Issue</a><a href={edit}>Edit</a></div>
  }
}
class Row extends Component {
  round (num) {
    if (isNaN(num)) {
      return '-'
    }
    if (num === Number.POSITIVE_INFINITY) {
      return 'Infinity'
    }
    return round(num, 2)
  }
  render () {
    let {className, label, count, expectation, ucb} = this.props
    return <tr className={className}>
      <td>{label}</td>
      <td>{count}</td>
      <td>{this.round(expectation)}</td>
      <td>{this.round(ucb)}</td>
      <td>{this.round(ucb - expectation)}</td>
    </tr>
  }
}

class BanditStats extends Component {
  render () {
    let {tags, stats} = this.props
    let rows = stats.map((st, i) => {
      let isActive = tags.indexOf(st.label) > -1
      let attrs = st
      attrs['className'] = cx({
        'tag-row': true,
        'active': isActive,
      })
      attrs.key = i
      return <Row {...attrs} />
    })
    return <table className='badint-stats'><tbody>{rows}</tbody></table>
  }
}

export class App extends Component {
  get tags () {
    return this.allTags.filter(t => {
      return !this.rejected[t]
    }).splice(0, 25)
  }
  constructor (props) {
    super(props)
    this.allTags = []
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
    let {tags, stats} = this.props
    let tagsId = '__tags'
    this.allTags = tags
    return (
      <div>
        <CopyButton target={`#${tagsId}`} />
        <Tags tags={this.tags} onTagClick={ (tag) => this.onTagClick(tag) } />
        <CopyTags tags={this.tags} id={tagsId} />
        <Links />
        <BanditStats stats={stats} tags={this.tags} />
      </div>
    )
  }
}
