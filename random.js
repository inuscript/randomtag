(function(){
  var masterTags = ["dog", "norfolkterrier"]
  var randomTags = ["adorable", "animal", "animales", "animallovers", "animals", "bestwoof", "blackandtan", "cute", "cutedog", "cutie", "dailydog", "dog", "doggie", "doggy", "doglover", "doglovers", "dogoftheday", "dogs", "dogs_of_instagram", 
  "dogsitting", "dogslife", "dogsofinstagram", "dogstagram", 
  "happy_pet", "hound", "ilovedog", "ilovedogs", "ilovemydog", "instadog", "instagood", "instagramdogs", "instapuppy", "instaterrier", "life", "love", "lovedogs", 
  "lovepuppies", "nature", "pet", "pets", "pets_of_instagram", "petsagram", "petsofinstagram", "petstagram", "photooftheday", "picpets", "precious", "pup", "puppies", "puppy", "smalldog", "tagblender", "terrier", "terriers", "terrierstagram"]
  // randomTags.sort().filter((x, i, self) => { return self.indexOf(x) === i })
  var shuffle = function(arr) {
    var random = arr.map(Math.random);
    arr.sort(function(a, b) {
      return Math.random() - 0.5
    })
    return arr
  }
  var getSuffled = function(){
    var tags = masterTags.concat()
    var maxRandTag =  30 - masterTags.length
    var len = Math.min(randomTags.length * 0.7, maxRandTag)
    var rand = shuffle(randomTags).slice(0, len)
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