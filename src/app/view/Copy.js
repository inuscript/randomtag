import React, { Component } from 'react'
import Clipboard from 'clipboard'

export default class Copy extends Component {
  get copyString(){
    let { tags } = this.props
    return tags.map((tag) => `#${tag}`).join(' ')
  }

  render(){
    let buttonId = '__copy__button__'
    let targetId = '__copy__button__target__'
    this.clipboard = new Clipboard(`#${buttonId}`)
    return <div>
      <button id={buttonId} data-clipboard-target={`#${targetId}`} >Copy !</button>
      <div id={targetId} className='copy-tag'>{this.copyString}</div>
    </div>
  }
}