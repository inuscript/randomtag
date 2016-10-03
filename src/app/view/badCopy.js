import React, { Component } from 'react'
import Clipboard from 'clipboard'
import uniqueId from './uniqueId'
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

export default class CopyTag extends Component {
  get copyString(){
    const { tags } = this.props
    return tags.map((tag) => `#${tag}`).join(' ')
  }
  constructor(){
    super()
    this.buttonClassName = 'copy__button'
    this.state = {
      showModal: false
    }
  }
  componentDidMount(){
    const { onCopySuccess } = this.props
    this.clipboard = new Clipboard(`.${this.buttonClassName}`)
    this.clipboard.on('success', (e) => {
      console.log("aaa")
      this.setState({
        showModal: true
      })
      setTimeout( () => {
        this.setState({
          showModal: false
        })
      }, 1000)
    })
  }
  componentWillUnmount(){
    this.clipboard.destroy()
  }
  render(){
    const targetId = `copy__button__target_${uniqueId()}`
    return <div>
      <button className={this.buttonClassName} data-clipboard-target={`#${targetId}`} >Copy !</button>
      <div id={targetId} className='copy-tag'>{this.copyString}</div>
      {
        (this.state.showModal)
          ? <div className={css(style.toast)}>Copied !</div>
          : <noscript />
      }
    </div>
  }
}