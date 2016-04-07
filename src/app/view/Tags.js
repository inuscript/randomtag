import React, { Component } from 'react'
import { round } from 'mathjs'

const Tag = ({tagLabel, onClick}) => {
  // なぜか最後に空白が無いとcssが崩れる。謎。
  let {label, num, exp} = tagLabel
  let msg = `#${label}(${num} : ${round(exp, 2) })`
  return <span className='tag-item' onClick={onClick}>
    <span className='tag-label'>{msg}</span>
  </span>
}

export default class Tags extends Component {
  render () {
    let {  onTagClick, tagLabels } = this.props
    return <div>{
      tagLabels.map((t,i) => <Tag key={i} tagLabel={t} onClick={ () => onTagClick(t.label) } />)
    }</div>
  }
}
