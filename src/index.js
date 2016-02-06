import "babel-polyfill"
import Clipboard from "clipboard"
import { node , Component, mountToDom } from 'vidom/lib/vidom';
import docReady from "doc-ready"
import calcTags from "./bandit/index"

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
  onRender({tag}){
    return node("span").children(`#${tag} `)
  }
}
class Tags extends Component{
  onRender({ tags, id }){
    return node("div")
      .attrs({id})
      .children(
        tags.map( (tag) => {
          return node(Tag).attrs({tag})
        })
      )
  }
}
class App extends Component{
  onRender({tags}){
    let tagsId = "__tags"
    return node("div")
      .children([
        node(CopyButton).attrs({ target: `#${tagsId}` }),
        node(Tags).attrs({ tags, id:tagsId }),
      ])
  }
}

docReady( function(){
  let container = document.getElementById('container')
  let ts = calcTags().then(tags => {
    mountToDom(container, node(App).attrs({tags: tags}));
  })
})
