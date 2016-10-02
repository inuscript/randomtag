import React, { Component } from 'react'
import Clipboard from 'clipboard'

class Copy extends Component {
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
    const { copyString } = this.props
    return <div>
      <button id={this.buttonId} data-clipboard-target={`#${this.targetId}`} >Copy !</button>
      <div id={this.targetId} className='copy-string'>{copyString}</div>
    </div>
  }
}

export default class CopyTag extends Component {
  get copyString(){
    const { tags } = this.props
    return tags.map((tag) => `#${tag}`).join(' ')
  }
  render(){
    return <Copy copyString={this.copyString} {...this.props} />
  }
}