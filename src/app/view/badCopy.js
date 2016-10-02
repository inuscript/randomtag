import React, { Component } from 'react'
import Clipboard from 'clipboard'

export default class CopyTag extends Component {
  get copyString(){
    const { tags } = this.props
    return tags.map((tag) => `#${tag}`).join(' ')
  }
  constructor(){
    super()
    this.buttonClassName = '__copy__button__'
  }
  componentDidMount(){
    const { onCopySuccess } = this.props
    this.clipboard = new Clipboard(`.${this.buttonId}`)
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
    const targetId = '__copy__button__target__' + Math.random()

    return <div>
      <button className={this.className} data-clipboard-target={`#${targetId}`} >Copy !</button>
      <div id={targetId} className='copy-tag'>{this.copyString}</div>
    </div>
  }
}