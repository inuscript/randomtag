import calcTags from '../bandit/'
import { App } from './index'
import { Component } from 'vidom/lib/vidom'

export default class Container extends Component{
  onInit() {
    this.tags = null
    this.stats = null
    calcTags(25, 170).then(({tags, stats}) => {
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
