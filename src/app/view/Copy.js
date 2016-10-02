import React, { Component } from 'react'
import Clipboard from 'clipboard'
import { StyleSheet, css } from 'aphrodite'

const style = StyleSheet.create({
  toast: {
    position: "fixed",
    right: 10,
    bottom: 10,
    zIndex: 100,
    background: "rgb(164, 238, 163)",
    color: "rgb(41, 62, 41)",
    padding: 8,
    fontSize: 12,
    borderRadius: 8
  }
})

const MessageToast = ({show, children}) => {
  if(!show){
    return <noscript />
  }
  return <div className={css(style.toast)}>{children}</div>
}

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
    this.state = {
      showModal: false
    }
  }
  componentDidMount(){
    const { onCopySuccess } = this.props
    this.clipboard = new Clipboard(`.${this.buttonClassName}`)
    this.clipboard.on('success', (e) => {
      if(onCopySuccess){
        onCopySuccess(e.text)
        this.setState({
          showModal: true
        })
        setTimeout( () => {
          this.setState({
            showModal: false
          })
        }, 1000)
      }
    })
  }
  componentWillUnmount(){
    this.clipboard.destroy()
  }
  render(){
    const { copyString } = this.props
    return (
      <div>
        <CopyButton
          buttonClassName={ this.buttonClassName }
          copyString={ copyString }
        />
        <MessageToast show={this.state.showModal}>Copied!</MessageToast>
      </div>
    )
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