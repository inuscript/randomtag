import React, { Component } from 'react'
import Clipboard from 'clipboard'

export default class CopyTag extends Component {
  get copyString(){
    const { tags } = this.props
    return tags.map((tag) => `#${tag}`).join(' ')
  }
  constructor(){
    super()
    this.buttonId = '__copy__button__'
    this.targetId = '__copy__button__target__' + Math.random()
  }
  componentDidMount(){
    const { onCopySuccess } = this.props
    this.clipboard = new Clipboard(`#${this.buttonId}`)
    this.clipboard.on('success', (e) => {
      if(onCopySuccess){
        onCopySuccess(e.text)
      }
    })
  }
  componentWillUnmount(){
    this.clipboard.destroy()
  }
  render(){
    return <div>
      <button id={this.buttonId} data-clipboard-target={`#${this.targetId}`} >Copy !</button>
      <div id={this.targetId} className='copy-tag'>{this.copyString}</div>
    </div>
  }
}