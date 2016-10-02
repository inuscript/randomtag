import React, { Component } from 'react'
import Clipboard from 'clipboard'
import uuid from 'uuid'
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
  },
  copyString: {
    borderRadius: "1em",
    padding: "1em",
    color: "#125688",
    background: "rgb(197, 205, 212)",
    fontSize: "small",
    select: "all"
  }
})

const MessageToast = ({show, children}) => {
  if(!show){
    return <noscript />
  }
  return <div className={css(style.toast)}>{children}</div>
}

const CopyButton = ({ buttonClassName, copyString }) => {
  const targetId = `copy__button__target_${uuid()}`
  return (
    <span>
      <button
        className={buttonClassName}
        data-clipboard-target={`#${targetId}`} >Copy !</button>
      <div id={targetId} className={css(style.copyString)}>{copyString}</div>
    </span>
  )
}

class Copy extends Component {
  constructor(){
    super()
    this.buttonClassName = '__copy__button__'
  }
  componentDidMount(){
    this.clipboard = new Clipboard(`.${this.buttonClassName}`)
    this.clipboard.on('success', (e) => {
      this.props.onCopySuccess()
    })
  }
  componentWillUnmount(){
    this.clipboard.destroy()
  }
  render(){
    const { copyString } = this.props
    return (
      <CopyButton
        buttonClassName={ this.buttonClassName }
        copyString={ copyString }
      />
    )
  }
}

class CopyWithToast extends Component{
  constructor(){
    super()
    this.state = {
      showModal: false
    }
    this.handleCopySuccess = this._handleCopySuccess.bind(this)
  }
  _handleCopySuccess() {
    this.setState({ showModal: true })
    setTimeout( () => {
      this.setState({ showModal: false })
    }, 1000)
  }
  render(){
    return (
      <div>
        <Copy {...this.props} onCopySuccess={this.handleCopySuccess} />
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
    return <CopyWithToast copyString={this.copyString} {...this.props} />
  }
}