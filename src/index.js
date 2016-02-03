import Clipboard from "clipboard"
import { node , Component, mountToDom } from 'vidom/lib/vidom';
import docReady from "doc-ready"

class App extends Component{
  onRender(){
    return node("div").children("hello")
  }
}

docReady( function(){
  let container = document.getElementById('container')
  mountToDom(container, node(App));
})
