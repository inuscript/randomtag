import 'babel-polyfill'
import docReady from 'doc-ready'
import { App } from './view/index'
import calcTags from './bandit/'
import { node, Component, mountToDom } from 'vidom/lib/vidom'

class Container extends Component{
  onInit() {
    this.tags = null
    this.stats = null
    calcTags().then(({tags, stats}) => {
      this.tags = tags
      this.stats = stats
      this.update()
    }).catch(e => {
      console.trace(e)
    })
  }
  onRender () {
    if(this.tags && this.stats){
      return <App tags={this.tags} stats={this.stats} />
    }
    return <div>Loading...</div>
  }
}

docReady(function () {
  let container = document.getElementById('container')
  mountToDom(container, node(Container))
})
