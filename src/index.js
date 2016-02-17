import "babel-polyfill"
import Clipboard from "clipboard"
import { node , Component, mountToDom } from 'vidom/lib/vidom';
import docReady from "doc-ready"
import calcTags from "./bandit/index"
import { round } from "mathjs"

class CopyButton extends Component{
  onRender({target}){
    let id = "__copy__button__"
    this.clipboard = new Clipboard(`#${id}`)
    return node("button")
      .attrs({
        "id": id,
        "data-clipboard-target": target
      })
      .children("Copy")
  }
}

class Tag extends Component{
  onRender({tag, onClick}){
    return node("span").children(`#${tag} `).attrs({
      class: "tag-item",
      onClick: e => onClick(tag)
    })
  }
}

class Tags extends Component{
  onRender({ tags , onTagClick }){
    return node("div")
      .children(
        tags.map( (tag) => {
          return node(Tag).attrs({
            tag,
            onClick: e => onTagClick(tag)
          })
        })
      )
  }
}

class CopyTags extends Component{
  onRender({ tags, id }){
    return node("div")
      .attrs({id, class: "copy-tag"})
      .children(tags.map( (tag) => `#${tag}` ).join(" "))
  }
}

class Links extends Component{
  onRender(){
    let base = "https://github.com/inuscript/dogtag"
    let issue = `${base}/issues/new?body=${base}/edit/gh-pages/tags.txt`
    let edit = `${base}/edit/master/tags.txt`
    return node("div")
      .children([
        node("a").attrs({href: issue}).children("Issue"),
        node("a").attrs({href: edit}).children("Edit")
      ])
  }
}
class Row extends Component{
  round(num){
    if(isNaN(num)){
      return "-"
    }
    return round(num, 2)
  }
  onRender({label, count, expectation, ucb }){
    return node("tr")
      .children([
        node("td").children(label),
        node("td").children(count),
        node("td").children(this.round(expectation)),
        node("td").children(this.round(ucb)),
        node("td").children(this.round(ucb - expectation))
      ])
  }
}
class BanditStats extends Component{
  onRender({stats}){
    let rows = stats.map( st => node(Row).attrs(st) )
    return node("table").attrs({class: "badint-stats"}).children(rows)
  }
}

class App extends Component{
  get tags(){
    return this.allTags.filter( t => {
      return !this.rejected[t]
    }).splice(0, 25)
  }
  onInit(){
    this.allTags = []
    this.rejected = {}
  }
  onTagClick(tag){
    if(this.rejected[tag]){
      this.rejected[tag] = 0
    }else{
      this.rejected[tag] = 1
    }
    this.update()
  }
  onRender({tags, stats}){
    let tagsId = "__tags"
    this.allTags = tags
    return node("div")
      .children([
        node(CopyButton).attrs({ target: `#${tagsId}` }),
        node(Tags).attrs({ 
          tags: this.tags, 
          onTagClick: tag => this.onTagClick(tag)
        }),
        node(CopyTags).attrs({ tags: this.tags, id:tagsId }),
        node(Links),
        node(BanditStats).attrs({ stats }),
      ])
  }
}

docReady( function(){
  let container = document.getElementById('container')
  let ts = calcTags().then( ({tags, stats}) => {
    container.innerHTML = "" // clean
    mountToDom(container, node(App).attrs({tags, stats}));
  }).catch(e => {
    console.error(e)
  })
})
