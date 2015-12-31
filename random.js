(function(){
  var masterTags = ["dog", "norfolkterrier"]
  var randomTags = ["adorable", "animal", "animales", "animallovers", "animals", "bestwoof", "blackandtan", "cute", "cutedog", "cutie", "dailydog", "doggie", "doggy", "doglover", "doglovers", "dogoftheday", "dogs", "dogsofig", "dogs_of_instagram", 
  "dogsitting", "dogslife", "dogsofinstagram", "dogstagram", 
  "happy_pet", "hound", "ilovedog", "ilovedogs", "ilovemydog", "instadog", "instagood", "instagramdogs", "instapuppy", "instaterrier", "life", "love", "lovedogs", 
  "lovepuppies", "nature", "pet", "pets", "pets_of_instagram", "petsagram", "petsofinstagram", "petstagram", "photooftheday", "picpets", "precious", "pup", "puppies", "puppy", "smalldog", "terrier", "terriers", "terrierstagram"]
  // randomTags.sort().filter((x, i, self) => { return self.indexOf(x) === i })
  var shuffle = function(arr) {
    var random = arr.map(Math.random);
    arr.sort(function(a, b) {
      return Math.random() - 0.5
    })
    return arr
  }
  var tagLen = function(){ // min = 11 max = 30
    var maxRandTag =  (30 - masterTags.length) - 11 
    return 11 + Math.random() * maxRandTag
  }
  var getSuffled = function(){
    var tags = masterTags.concat()
    var rand = shuffle(randomTags).slice(0, tagLen())
    console.log(rand.length)
    return shuffle(tags.concat(rand))
  }
  var arrToTagStr = function(arr){
    return arr.map(function(tag){
      return "#" + tag
    }).join(" ")
  }
  $(function(){
    $("#tags").text(arrToTagStr(getSuffled()))
  })
  // Clipboard.js
  new Clipboard('.btn');
})(jQuery)