import Clipboard from 'clipboard'
import { node, Component } from 'vidom/lib/vidom'
import { round } from 'mathjs'
import cx from 'classnames'

class CopyButton extends Component {
  onRender ({target}) {
    let id = '__copy__button__'
    this.clipboard = new Clipboard(`#${id}`)
    return <button id={id} data-clipboard-target={target} >Copy !</button>
  }
}

class Tag extends Component {
  onRender ({tag, onClick}) {
    // なぜか最後に空白が無いとcssが崩れる。謎。
    return <span className='tag-item' onClick={ () => onClick(tag)}>{`#${tag} `}</span>
  }
}

class Tags extends Component {
  onRender ({ tags, onTagClick }) {
    return <div>{
      tags.map(tag => <Tag tag={tag} onClick={ () => onTagClick(tag) } />)
    }</div>
  }
}

class CopyTags extends Component {
  onRender ({ tags, id }) {
    let copyStrings = tags.map((tag) => `#${tag}`).join(' ')
    return <div id={id} className='copy-tag'>{copyStrings}</div>
  }
}

class Links extends Component {
  onRender () {
    let base = 'https://github.com/inuscript/dogtag'
    let issue = `${base}/issues/new?body=${base}/edit/gh-pages/tags.txt`
    let edit = `${base}/edit/master/tags.txt`
    return <div><a href={issue}>Issue</a><a href={edit}>Edit</a></div>
  }
}
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
  onRender ({className, label, count, expectation, ucb }) {
    return <tr className={className}>
      <td>{label}</td>
      <td>{count}</td>
      <td>{this.round(expectation)}</td>
      <td>{this.round(ucb)}</td>
      <td>{this.round(ucb - expectation)}</td>
    </tr>
  }
}
class BanditStats extends Component {
  onRender ({stats, tags}) {
    let rows = stats.map(st => {
      let isActive = tags.indexOf(st.label) > -1
      let attrs = st
      attrs['className'] = cx({
        'tag-row': true,
        'active': isActive
      })
      return node(Row).attrs(attrs)
    })
    return <table className='badint-stats'>{rows}</table>
  }
}

export class App extends Component {
  get tags () {
    return this.allTags.filter(t => {
      return !this.rejected[t]
    }).splice(0, 25)
  }
  onInit () {
    this.allTags = []
    this.rejected = {}
  }
  onTagClick (tag) {
    if (this.rejected[tag]) {
      this.rejected[tag] = 0
    } else {
      this.rejected[tag] = 1
    }
    this.update()
  }
  onRender ({tags, stats}) {
    let tagsId = '__tags'
    this.allTags = tags
    return (
      <div>
        <CopyButton target={`#${tagsId}`} />
        <Tags tags={this.tags} onTagClick={ (tag) => this.onTagClick(tag) } />
        <CopyTags tags={this.tags} id={tagsId} />
        <Links />
        <BanditStats stats={stats} tags={this.tags} />
      </div>
    )
  }
}
