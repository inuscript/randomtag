import React, { Component } from 'react'
import { withProps, renderComponent, compose } from 'recompose'
const Tag = ({tagLabel, onClick}) => {
  // なぜか最後に空白が無いとcssが崩れる。謎。
  let {label, num, exp} = tagLabel
  return <span className='tag-item' onClick={onClick}>
    <span className='tag-label'>{`#${label}`}</span>
    <span className='tag-num'>{num}</span>
    <span className='tag-exp'>{`${Math.ceil(exp * 1000) / 10  }%`}</span>
  </span>
}

export default class Tags extends Component {
  render () {
    let { onTagClick, hashTags } = this.props
    return <div>{
      hashTags.map((t,i) => {
        if(t.selected){
          let props = {tagLabel:t, onClick: () => onTagClick(t.label)}
          let TagItem = withProps(props)(Tag)
          return <TagItem key={i} />
        }
        return null
      })
    }</div>
  }
}
