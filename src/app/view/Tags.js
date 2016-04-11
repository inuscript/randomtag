import React, { Component } from 'react'
import { withProps, compose, branch, renderNothing, renderComponent } from 'recompose'

const Tag = (props) => {
  let {tagLabel, onClick} = props
  let {label, num, exp} = tagLabel
  return <span className='tag-item' onClick={onClick} >
    <span className='tag-label'>{`#${label}`}</span>
    <span className='tag-num'>{num}</span>
    <span className='tag-exp'>{`${Math.ceil(exp * 1000) / 10  }%`}</span>
  </span>
}

const tagWrap = (tag) => (
  branch(
    () => tag.selected,
    withProps({
      tagLabel:tag
    }),
    renderNothing()
  )
)


export default class Tags extends Component {
  render () {
    let { onTagClick, hashTags } = this.props
    return <div>{
      hashTags.map((t) => {
        let TagItem = compose(
          withProps({
            onClick: () => onTagClick(t.label)
          }),
          tagWrap(t)
        )(Tag)
        // ↓why?
        return renderComponent(TagItem)(<div/>)({key: t.label})
        // return <TagItem key={t.label} />
      })
    }</div>
  }
}
