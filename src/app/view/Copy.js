import React, { Component } from 'react'
import Clipboard from 'clipboard'

export default class CopyTag extends Component {
  get copyString(){
    const { tags } = this.props
    return tags.map((tag) => `#${tag}`).join(' ')
  }

  render(){
    const buttonId = '__copy__button__'
    const targetId = '__copy__button__target__'
    this.clipboard = new Clipboard(`#${buttonId}`)
    this.clipboard.on('success', () => {
      console.log("success")
    })
    return <div>
      <button id={buttonId} data-clipboard-target={`#${targetId}`} >Copy !</button>
      <div id={targetId} className='copy-tag'>{this.copyString}</div>
    </div>
  }
}