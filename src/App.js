import { useState, useEffect } from 'react';
import { NFTStorage, File } from 'nft.storage'
import { Buffer } from 'buffer';
import { ethers } from 'ethers';
import axios from 'axios';

// Components
import Spinner from 'react-bootstrap/Spinner';
import Navigation from './components/Navigation';

// ABIs
import NFT from './abis/NFT.json'

// Config
import config from './config.json';

function App() {
  const [provider, setProvider] = useState(null)
  const [account, setAccount] = useState(null)
  const [name, setName] = useState()
  const [description, setDescription] = useState()
  const [image, setImage] = useState(null)
  const [url, setURL] = useState(null);
  const [nft, setNFT] = useState(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const [message, setMessage] = useState('')

  const loadBlockchainData = async () => {
    const provider = new ethers.providers.Web3Provider(window.ethereum)
    setProvider(provider)

    //gets the chainid network easily for us to determine which contracts to use
    const network = await provider.getNetwork()

    const nft = new ethers.Contract(config[network.chainId].nft.address, NFT, provider)
    setNFT(nft)
  }

  const submitHandler = async (e) => {
    e.preventDefault()
    // console.log('Submitting')

    if(name === '' || description === '') {
      window.alert('Please provide name and description')
      return
    }
   
    setIsWaiting(true)

    // calling api to start image
    const imageData = createImage();

    const url = await uploadImage(imageData);

    // console.log('Url', url)

    await mintImage(url)

    console.log('Success Minted!')
    setIsWaiting(false)
    setMessage('')

  }

  const createImage = async () => {
    // console.log('Generating Image...')
    setMessage('Generating Image')

    // axios request 
    const response = await axios({
      url: 'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2', 
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.REACT_APP_HUGGING_FACE_API_KEY}`, 
        Access: 'application/json',
        'Content-Type': 'application/json'
      },
      data: JSON.stringify({
        inputs: description, options: {wait_for_model: true},
      }),
      responseType: 'arraybuffer',
    })

    const type = response.headers['content-type']
    const data = response.data;

    const base64Data = Buffer.from(data).toString('base64')
    const img = `data:${type};base64,` + base64Data;
    setImage(img);

    return data

  }

  const uploadImage = async (imageData) => {
    // console.log('Uploading image to blockchain')
    setMessage('Uploading Image')

    // to store the nft on ipfs we dont use ipfs-http-client anymore
    // connect to nftstorage website
    const nftStorage = new NFTStorage({ token: process.env.REACT_APP_NFT_STORAGE_API_KEY})

    // request to store image
    const {ipnft} = await nftStorage.store({
      image: new File([imageData], 'image.jpeg', {type: 'image/jpeg'}),
      name: name, 
      description, description
    })

    // save url 
    const url = `https://ipfs.io/ipfs/${ipnft}/metadata.json`
    setURL(url);
    return url;

  }

  const mintImage = async (tokenURI) => {
    // console.log('Waiting for Mint')
    setMessage('Waiting for Mint')

    // in order to do transactions we need a signer
    const signer = await provider.getSigner();

    // this is where we send the ethers with the function 
    const transaction = await nft.connect(signer).mint(tokenURI, {value: ethers.utils.parseUnits('1', 'ether')})
    await transaction.wait()

  }

  useEffect(() => {
    loadBlockchainData()
  }, [])

  return (
    <div>
      <Navigation account={account} setAccount={setAccount} />
      
      <div className='form'>
        <form onSubmit={submitHandler}>
          <input type='text' placeholder='Create a name ...' onChange={(e) => {setName(e.target.value)}} />
          <input type='text' placeholder='Create a description' onChange={(e) => {setDescription(e.target.value)}} />
          <input type='submit' value='Create & Mint' />
        </form>

        <div className='image'>
          {
            !isWaiting && image ? (
               <img src={image} alt='AI Generated Image'/> 
            ) : isWaiting ? (
          <div className='image__placeholder'>
          <Spinner animation='border' />
          <p>{message}</p>
            </div>
            ): (
              <></>
            )
          }
        </div>

      </div>
        {/* url will not be shown until url and iswaiting is false  */}
          {!isWaiting && url && (
            
      <p>View&nbsp;<a href={url} target='_blank' rel='noreferrer'>Metadata</a></p>
          )}
    </div>
  );
}

export default App;
