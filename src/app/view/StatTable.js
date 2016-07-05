import React, { Component } from 'react'
import cx from 'classnames'
import { round } from 'mathjs'

class Row extends Component {
  round (num) {
    if (isNaN(num)) {
      return '-'
    }
    if (num === Number.POSITIVE_INFINITY) {
      return 'Infinity'
    }
    return round(num, 2)
  }
  render () {
    let {className, label, count, expectation, ucb} = this.props
    return <tr className={className} >
      <td>{label}</td>
      <td>{count}</td>
      <td>{this.round(expectation)}</td>
      <td>{this.round(ucb)}</td>
      <td>{this.round(ucb - expectation)}</td>
    </tr>
  }
}

const TableHead = () => (
  <tr className='tag-row'>
    <th>Label</th>
    <th>Count</th>
    <th>Exp</th>
    <th>UCB</th>
    <th>UCB - Exp</th>
  </tr>
)

export default class BanditStats extends Component {
  render () {
    let {tags, stats} = this.props
    let rows = stats.map((st, i) => {
      let isActive = tags.indexOf(st.label) > -1
      let attrs = st
      attrs['className'] = cx({
        'tag-row': true,
        'active': isActive
      })
      attrs.key = i
      return <Row {...attrs} />
    })
    return <table className='badint-stats'>
      <thead><TableHead/></thead>
      <tbody>{rows}</tbody>
    </table>
  }
}