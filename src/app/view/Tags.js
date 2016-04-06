import React, { Component } from 'react'

class Tag extends Component {
  render () {
    let {tag, onClick, tagLabel} = this.props
    // なぜか最後に空白が無いとcssが崩れる。謎。
    return <span className='tag-item' onClick={ () => onClick(tag)}>
      <span className='tag-label'>{`#${tag} `}</span>
    </span>
  }
}

export default class Tags extends Component {
  render () {
    let { tags, onTagClick } = this.props
    return <div>{
      tags.map((tag,i) => <Tag key={i} tag={tag} onClick={ () => onTagClick(tag) } />)
    }</div>
  }
}
