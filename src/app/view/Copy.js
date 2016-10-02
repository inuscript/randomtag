import React, { Component } from 'react'
import Clipboard from 'clipboard'

const CopyButton = ({ buttonClassName, copyString }) => {
  const targetId = `copy__button__target`
  return (
    <span>
      <button
        className={buttonClassName}
        data-clipboard-target={`#${targetId}`} >Copy !</button>
      <div id={targetId} className='copy-string'>{copyString}</div>
    </span>
  )
}

class Copy extends Component {
  constructor(){
    super()
    this.buttonClassName = '__copy__button__'
  }
  componentDidMount(){
    const { onCopySuccess } = this.props
    this.clipboard = new Clipboard(`.${this.buttonClassName}`)
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
    return <CopyButton
      buttonClassName={ this.buttonClassName }
      copyString={ copyString }
    />
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