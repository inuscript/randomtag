import React, { Component } from 'react'
import { withProps, compose, branch, renderNothing } from 'recompose'

const Tag = ({tagLabel, onClick}) => {
  // なぜか最後に空白が無いとcssが崩れる。謎。
  let {label, num, exp} = tagLabel
  return <span className='tag-item' onClick={onClick}>
    <span className='tag-label'>{`#${label}`}</span>
    <span className='tag-num'>{num}</span>
    <span className='tag-exp'>{`${Math.ceil(exp * 1000) / 10  }%`}</span>
  </span>
}

const tagWrap = (tag, onTagClick) => (
  branch(
    () => tag.selected, 
    withProps({
      tagLabel:tag, 
      onClick: () => onTagClick(tag.label)
    }),
    renderNothing()
  )
)(Tag)


export default class Tags extends Component {
  render () {
    let { onTagClick, hashTags } = this.props
    return <div>{
      hashTags.map((t,i) => {
        let TagItem = tagWrap(t, onTagClick)
        return <TagItem key={i} />
      })
    }</div>
  }
}
