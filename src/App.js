import React, { useState, useEffect } from 'react';
import userLogo from './assets/user.svg';
import './App.css';
import idl from './idl.json';
import { Transaction, Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { Program, web3 } from '@project-serum/anchor';
import kp from './keypair.json'
import { validateAmount } from './Regex';
import { getProvider } from './components/GetProvider';

// SystemProgram is a reference to the Solana runtime!
const { SystemProgram } = web3;

// Create a keypair for the account that will hold the GIF data.
const arr = Object.values(kp._keypair.secretKey)
const secret = new Uint8Array(arr)
const baseAccount = web3.Keypair.fromSecretKey(secret)

// Get our program's id from the IDL file.
const programID = new PublicKey(idl.metadata.address);

// Set our network to devnet.
const network = clusterApiUrl('devnet');

// Controls how we want to acknowledge when a transaction is "done".
const opts = {
  preflightCommitment: "processed"
}

const App = () => {
  // State
  const [walletAddress, setWalletAddress] = useState(null);
  const [exploring, setExploring] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [nameInputValue, setNameInputValue] = useState('');
  const [usernameInputValue, setUsernameInputValue] = useState('');
  const [creatingCreator, setCreatingCreator] = useState(false);
  const [creatingSupporter, setCreatingSupporter] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [creatorIndex, setCreatorIndex] = useState(0);
  const [msgInputValue, setMsgInputValue] = useState('');
  const [amountInputValue, setAmountInputValue] = useState(0);
  const [buySolStatus, setBuySolStatus] = useState('');
  
  // States retrieved from solana program
  const [creatorList, setCreatorList] = useState([]);
  const [supporterList, setSupporterList] = useState([]);
  const [messages, setMessages] = useState([]);
  const [userIndex, setUserIndex] = useState(null);
  const [hasSupporterAcc, setHasSuporterAcc] = useState(false);

  // Check if Phantom wallet is connected or not
  const checkIfWalletIsConnected = async () => {
    try {
      // First make sure we have access to window.solana
      // MetaMask automatically injects an special object named solana
      const { solana } = window;

      if (solana.isPhantom) {
        console.log('Phantom wallet found!');

        // Connect the users wallet if we're authorized to acess user's wallet
        const response = await solana.connect({ onlyIfTrusted: true });
        console.log(
          'Connected with Public Key:',
          response.publicKey.toString()
        );
        setWalletAddress(response.publicKey.toString());
      } else {
        alert('Solana object not found! Get a Phantom Wallet 👻');
      }
    } catch (error) {
      console.error(error);
    }
  }

  // Connect to wallet
  const connectWallet = async () => {
    const { solana } = window;

    if (solana) {
      const response = await solana.connect();
      console.log('Connected with Public Key:', response.publicKey.toString());
      setWalletAddress(response.publicKey.toString());
    }
  };

  // Initialize solana program
  const createBaseAccount = async () => {
    try {
      const provider = getProvider();
      const program = new Program(idl, programID, provider);
      console.log("🚀 Starting....")
      await program.rpc.initialize({
        accounts: {
          baseAccount: baseAccount.publicKey,
          user: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        },
        signers: [baseAccount]
      });
      console.log("Created a new BaseAccount w/ address:", baseAccount.publicKey.toString())
      await getCreatorList();
      await getSupporterList();
      await getMessages();
    } catch(error) {
      console.log("Error creating BaseAccount account:", error)
    }
  }

  const getCreatorList = async() => {
    try {
      const provider = getProvider();
      const program = new Program(idl, programID, provider);
      const account = await program.account.baseAccount.fetch(baseAccount.publicKey);
      
      console.log("Got the account", account)
      setCreatorList(account.creatorList)
    } catch (error) {
      console.log("Error in getCreatorList : ", error)
      setCreatorList(null)
    }
  }

  // Get messages from the solana program
  const getMessages = async() => {
    try {
      const provider = getProvider();
      const program = new Program(idl, programID, provider);
      const account = await program.account.baseAccount.fetch(baseAccount.publicKey);
      
      setMessages(account.messages)
    } catch (error) {
      console.log("Error in getting messages : ", error)
    }
  }

  // Send message and solana to creator
  const sendMessage = async () => {
    if (!validateAmount.test(amountInputValue.toString())) {
      alert("Not a valid amount 🙅")
      return
    }
    if (amountInputValue.toString() === '0') return
    console.log(msgInputValue)
    console.log(amountInputValue)

    setBuySolStatus("sendingSol")

    try {
      const connection = new Connection(network, opts.preflightCommitment);
      const provider = getProvider();
      const program = new Program(idl, programID, provider);

      // Send Sol
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: provider.wallet.publicKey,
          toPubkey: creatorList[creatorIndex].userAddress,
          lamports: 1000000000 * amountInputValue,
        })
      );

      transaction.feePayer = provider.wallet.publicKey
      console.log("Getting recent blockhash")
      transaction.recentBlockhash = (await connection.getRecentBlockhash()).blockhash

      const { signature } = await window.solana.signAndSendTransaction(transaction);
      const result = await connection.confirmTransaction(signature);

      console.log("Transfered 🤗. Signature :", signature)
      console.log("Result :", result)
      alert("🥳 SOL sent successfully!")

      setBuySolStatus('sendingMsg')
      
      // Add message
      await program.rpc.addMessage(creatorList[creatorIndex].userAddress, msgInputValue, amountInputValue.toString(),{
        accounts: {
          baseAccount: baseAccount.publicKey,
          user: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        }
      });

      setMsgInputValue('')
      setAmountInputValue('')

      alert("🥳 Message sent successfully")
      setBuySolStatus('')

      await getMessages()
    } catch (error) {
      setBuySolStatus('')
      console.log("Error sending message: ",error)
    }
  }

  // Call create creator account
  const sendCreator = async () => {
    if (usernameInputValue.length === 0) {
      console.log("No username given!")
      return
    }
    if (nameInputValue.length === 0) {
      console.log("No name given!")
      return
    }
    const usernameFromList = creatorList.map((item) => {
      if (usernameInputValue === item.username.toString()) {
        return item.username.toString()
      }
      return item.username.toString()
    })
    if (usernameInputValue.toString() === usernameFromList.toString()) {
      alert("Username already taken 🤕")
      return
    }

    // Restricts user from creating a creator account if he/she already has one
    creatorList.forEach((item) => {
      if (walletAddress === item.userAddress.toString()) {
        alert("You can only have one creator account!")
        return
      }
    });
    
    console.log('Name: ', nameInputValue, ' Username: ', usernameInputValue)
    try {
      const provider = getProvider();
      const program = new Program(idl, programID, provider);

      await program.rpc.createCreator(usernameInputValue, nameInputValue, {
        accounts: {
          baseAccount: baseAccount.publicKey,
          user: provider.wallet.publicKey,
        }
      });
      setUsernameInputValue('')
      setNameInputValue('')

      alert("Successfully created creator account 🥳 ", nameInputValue, " ", usernameInputValue)

      await getCreatorList()
    } catch (error) {
      console.log("Error creating creator account: ",error)
    }
  }

  // Retrieve supporters from solana program
  const getSupporterList = async() => {
    try {
      const provider = getProvider();
      const program = new Program(idl, programID, provider);
      const account = await program.account.baseAccount.fetch(baseAccount.publicKey);
      
      console.log("Got the account", account)
      setSupporterList(account.supporterList)
    } catch (error) {
      console.log("Error in getSupporterList : ", error)
      setSupporterList(null)
    }
  }

  // Let user create a supporter account by calling create_supporter
  const sendSupporter = async() => {
    if (nameInputValue.length === 0) {
      console.log("No name given!")
      return
    }
    console.log(nameInputValue)

    try {
      const provider = getProvider();
      const program = new Program(idl, programID, provider);

      await program.rpc.createSupporter(nameInputValue, {
        accounts: {
          baseAccount: baseAccount.publicKey,
          user: provider.wallet.publicKey,
        }
      });
      setNameInputValue('')

      alert("Successfully created supporter account 🥳 ", nameInputValue)

      await getSupporterList()
    } catch (error) {
      console.log("Error creating supporter account: ",error)
    }
  }

  // Search creator using search bar
  const searchCreator = () => {
    if (!walletAddress) {
      connectWallet()
      return
    }
    if (!creatorList) return

    setInputValue('')

    const stringifiedCreatorList = JSON.stringify(creatorList)

    if(!stringifiedCreatorList.includes(inputValue)) {
      alert("Username not found ☹️")
      return
    }

    creatorList.forEach((item, index) => {
      if (inputValue === item.username.toString()) {
        setViewing(true)
        setCreatorIndex(index)
      }
    });
  }

  const checkIfUserHasAccount = () => {
    // If user already has creator account, render creators home page and set user index
    creatorList.forEach((item, index) => {
      if (walletAddress === item.userAddress.toString()) {
        setUserIndex(index)
        setViewing(true)
        setCreatorIndex(index)
      }
    });
    // If user has supporter account, render auth accordinly
    supporterList.forEach((item) => {
      if (walletAddress === item.userAddress.toString()) setHasSuporterAcc(true)
    });
  }

  // Checks if user has created an account
  const userExists = ( userAddress ) => {
    const inCreator = creatorList.filter((c) => c?.userAddress?.toString() === userAddress?.toString())
    if (inCreator.length) return inCreator[0]?.name
    const inSupporter = supporterList.filter((s) => s?.userAddress?.toString() === userAddress?.toString())
    if (inSupporter.length) return inSupporter[0]?.name
  }

  useEffect(() => {
    const onLoad = async () => {
      await checkIfWalletIsConnected();
    };
    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);

  useEffect(() => {
    if (walletAddress) {
      console.log('Fetching creator list...');
      getCreatorList()
      console.log('Fetching supporter list...');
      getSupporterList()
      console.log('Fetching messages...');
      getMessages()
    }
  },[walletAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (creatorList) checkIfUserHasAccount()
  }, [creatorList]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (supporterList) checkIfUserHasAccount()
  }, [supporterList]) // eslint-disable-line react-hooks/exhaustive-deps

  // Render Connect Wallet Button
  const renderConnectWalletButton = () => (
    <button className="button gradient-button" onClick={connectWallet}>
      Connect Wallet
    </button>
  );

  // If wallet is connect, render explore creator button
  const renderExploreButton = () => (
    <button className="button gradient-button" onClick={() => {
        setExploring(true)
        setViewing(false)
      }}>
      Explore Creators
    </button>
  );

  // If user don't have supporter account, render supporter button
  const renderSupporterButton = () => (
    <button className="button auth-button" onClick={
      () => {
        if (!walletAddress) connectWallet()
        setCreatingSupporter(true)
      }
    }>
      Supporter
    </button>
  );

  // Let user choose who he/she is, creator or supporter
  const renderAuthContainer = () => {
    if (userIndex) return
    if (creatorList === null) {
      return (
        <button className="button auth-button" onClick={() => {
          createBaseAccount()
        }}>
          Do One-Time Initialization
        </button>
      )
    } else {
      return(
        <div className="auth-container">
          <h1 className="main-text">
            {!hasSupporterAcc ? 'Who are you?' : 'Switch to Creator'}
          </h1>
          <div className="button-container">
            <button className="button auth-button" onClick={
              () => {
                if (!walletAddress) connectWallet()
                setCreatingCreator(true)
              }
            }>
              Creator
            </button>
            {!hasSupporterAcc && renderSupporterButton()}
          </div>
        </div>
      )
    }
  }

  // If wallet not connect, display text
  const renderIfWalletNotConnected = () => (
    <h1 className="main-text">
      Give your audience<br></br>
      <span className="gradient-text">Solana</span> way<br></br>
      to say thanks 🤗
      <p className="sub-text">
        The fastest, easiest and decentralized way to say thanks.
      </p>
    </h1>
  );

  // Render creators list if user clicked explore creator button
  const renderExploreCreatorContainer = () => (
    <div className="creator-container">
      {creatorList.map((item, index) => (
        <div className="list-item" key={index} onClick={() => {
          console.log("Viewing...")
          setViewing(true)
          setCreatorIndex(index)
        }}>
          <img className="user-log" src={userLogo} alt="User"/>
          <div className="name-container">
            <div>{item.name.toString()}</div>
            <div className="name-container username">{item.username.toString()}</div>
          </div>
        </div>
      ))}
    </div>
  );
  
  // Render this if user not creating account
  const renderSearchCreatorInputField = () => {
    if (creatorList !== null) {
      return(
        <form
            onSubmit={(event) => {
              event.preventDefault();
              console.log(inputValue);
              searchCreator()
            }}
        >
          <input type="text" placeholder="Search for creators" value={inputValue} onChange={(e) => setInputValue(e.target.value)}/>
        </form>
      )
    }
  };

  // Render creator form if user wants to create account as creator
  const renderCreatorForm = () => (
    <div className="form-container">
      <div className="main-text">
        Create Your Creator Account
        <div className="form-if-title">
          Name
          <input className="form-if" placeholder="Enter your name" value={nameInputValue} onChange={(e) => setNameInputValue(e.target.value)}/>
        </div>
        <div className="form-if-title">
          Username
          <form
            onSubmit={(event) => {
              event.preventDefault()
              sendCreator()
            }}
          >
            <input className="form-if" placeholder="Enter your username" value={usernameInputValue} onChange={(e) => setUsernameInputValue(e.target.value)}/>
          </form>
        </div>
      </div>
      <button className="button auth-button" onClick={() => {
        sendCreator()
      }}>
        Submit
      </button>
    </div>
  );

  // Render supporter form if user wants to create account as supporter
  const renderSupporterForm = () => (
    <div className="form-container">
      <div className="main-text">
        Create Your Creator Account
        <div className="form-if-title">
          Name
          <form
            onSubmit={(event) => {
              event.preventDefault()
              sendSupporter()
            }}
          >
            <input className="form-if" placeholder="Enter your name" value={nameInputValue} onChange={(e) => setNameInputValue(e.target.value)}/>
          </form>
        </div>
      </div>
      <button className="button auth-button" onClick={() => {
        sendSupporter()
      }}>
        Submit
      </button>
    </div>
  );

  // Render buy container if supporters are viewing page
  const renderBuyContainer = () => (
    <div className="buy-container">
      <div className="bold-text"> 
      Buy {creatorList[creatorIndex].name.toString()} some Sol
      </div>
      <div className="buy-section">
        <div className="normal-text">Enter you message</div>
        <input className="message-box" placeholder="Say something  nice.....😎" value={msgInputValue} onChange={(e) => setMsgInputValue(e.target.value)}/>
        <div className="normal-text">Enter amount</div>
        <form
            onSubmit={(event) => {
              event.preventDefault()
              // Send Message
              sendMessage()
            }}
          >
          <input className="message-box amount-box" placeholder="0" value={amountInputValue} onChange={(e) => setAmountInputValue(e.target.value)}/>
        </form>
            <div className="normal-text tiny-text">You need to approve transection twice</div>
      </div>
      <button className="button auth-button" onClick={
        () => {
          // Send Message
          sendMessage()
        }
      }>
        {buySolStatus === "sendingSol" ? 'Sending SOL...' : ''}
        {buySolStatus === "" ? `Support ${amountInputValue} SOL` : ''}
        {buySolStatus === "sendingMsg" ? 'Sending Msg...' : ''}
      </button>
    </div>
  );

  // Render creator page
  const renderCreatorPage = () => (
    <div className="main-container">
      <div className="profile-circle">
        <img className="user-log" src={userLogo} alt="User"/>
      </div>
      <div className="name-supporter-conatiner">
        <div className="cp-name-container">
          <div className="bold-text">{creatorList[creatorIndex].name.toString()}</div>
          <div className="normal-text">{creatorList[creatorIndex].username.toString()}</div>
        </div>
        <div className="sub-text">Hello 🤗<br/>
        Here’s my recent supporters 😎
        </div>
        <div className="supporter-box">
          {messages.map((item, index) => (
            (creatorList[creatorIndex].userAddress.toString() === item.creatorAddress.toString()) && (
              <div className="list-item supporter-item" key={index}>
                <img className="user-log" src={userLogo} alt="User"/>
                <div className="amount-message-container">
                  <div className="normal-text">
                    {userExists(item.supporterAddress) !== null ?
                      `${userExists(item.supporterAddress)} bought ${item.solAmount.toString()} Sol`
                      :
                      `${item.supporterAddress.toString()} bought ${item.solAmount.toString()} Sol`
                    }
                  </div>
                  <div className="message-container">
                    {item.message.toString()}
                  </div>
                </div>
              </div>
            )
          ))}
        </div>
      </div>
      {(creatorList[creatorIndex].userAddress.toString() !== walletAddress) && renderBuyContainer()}
    </div>
  );

  return (
    <div className="App">
      <div className="container">
        <div className="header-container">
          <button className="logo-text" onClick={
            () => {
              if (exploring) {
                if (userIndex) {
                  setCreatorIndex(userIndex)
                  setViewing(true)
                }
                setExploring(false)
              }
              if (creatingCreator) setCreatingCreator(false)
              if (creatingSupporter) setCreatingSupporter(false)
              if (viewing) {
                if (userIndex) setCreatorIndex(userIndex)
                else setViewing (false)
              }
            }
          }>
            Buy Me Sol
          </button>
          {!walletAddress && renderConnectWalletButton()}
          {!creatingCreator && !creatingSupporter && walletAddress  && renderExploreButton()}
        </div>
        <div className="body-container">
          {!viewing && !creatingCreator && !creatingSupporter && walletAddress && renderSearchCreatorInputField()}
          {viewing && renderCreatorPage()}
          <div className="main-container">
            {!walletAddress && renderIfWalletNotConnected()}
            {!exploring && !creatingCreator && !creatingSupporter && renderAuthContainer()}
            {!viewing && exploring && renderExploreCreatorContainer()}
            {creatingCreator && walletAddress && renderCreatorForm()}
            {creatingSupporter && walletAddress && renderSupporterForm()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
