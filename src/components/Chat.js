import Web3 from "web3";
import React, { Component } from "react";
import ChatApp from "../abis/ChatApp.json";
import mainLogo from "./arrow.png";

/**
 * Chat Component: A React-based blockchain chat application that uses
 * Web3.js to interact with a smart contract.
 */
class Chat extends Component {
  /**
   * React Lifecycle: Invoked before the component is mounted.
   * Initializes Web3, loads blockchain data, and sets up event listeners.
   */
  async componentWillMount() {
    await this.loadWeb3();
    await this.loadBlockchainData();
    await this.listenToMessages();
    await this.listenToEther();
    await this.listenToAskEther();
    await this.listenToFetchAllMsg();
    await this.fetchAllMsg();
    await this.updateUIData();
  }

  /**
   * Constructor: Initializes the component's state with default values.
   * @param {object} props - React component props.
   */
  constructor(props) {
    super(props);

    // Default chat messages to display.
    let chats = [
      {
        msg: "This is a blockchain demo, try to tap in!",
        response: true,
      },
      {
        msg:
          'Enter "send_ether: 0.0001" to send some tokens to your recipient 😃',
        response: false,
      },
    ];

    // State initialization.
    this.state = {
      fixedChats: chats,
      chats: [],
      inputValue: "",
      accounts: [],
      account: "",
      nbBlocks: 0,
      otherAccount: "",
      accountNbTransactions: 0,
      otherAccountNbTransactions: 0,
      accountBalance: 0,
      otherAccountBalance: 0,
      lastGas: 0,
      blockHash: "",
      didATransaction: false,
      isLastTransactionSuccess: false,
      didARequest: false,
      accountRequesting: "",
      accountRequested: "",
      valueRequested: 0,
    };
  }

  // ------- Initialization Methods ------

  /**
   * Initializes Web3 and sets up a Web3 provider.
   */
  async loadWeb3() {
    if (window.ethereum) {
      // Need to put ws:// instead of http:// because of web sockets.
      // Web sockets are mandatory to listen to events.
      window.web3 = new Web3(
        Web3.providers.WebsocketProvider("ws://localhost:7545")
      );
      await window.ethereum.enable();
    } else if (window.web3) {
      window.web3 = new Web3(window.web3.currentProvider);
    } else {
      window.alert(
        "Non-Ethereum browser detected. You should consider trying MetaMask!"
      );
    }
  }

  /**
   * Loads blockchain data such as accounts, balances, and the smart contract instance.
   */
  async loadBlockchainData() {
    const web3 = window.web3;

    // Fetch accounts.
    const accounts = await web3.eth.getAccounts();
    this.setState({
      accounts: accounts,
      account: accounts[0],
      otherAccount: accounts[1],
    });

    // Fetch account balances.
    const ethBalance = await web3.eth.getBalance(this.state.account);
    const ethBalance2 = await web3.eth.getBalance(this.state.accounts[1]);
    this.setState({
      accountBalance: ethBalance,
      otherAccountBalance: ethBalance2,
    });

    // Load smart contract
    const networkId = await web3.eth.net.getId();
    const chatAppData = ChatApp.networks[networkId];
    const abi = ChatApp.abi;
    if (chatAppData) {
      const chatContract = new web3.eth.Contract(abi, chatAppData.address);
      this.setState({ chatContract: chatContract });
    } else {
      window.alert("Chat contract not deployed to detected network.");
    }
  }

  // ------- Event Listeners ------

  /**
   * Listens for `messageSentEvent` and handles received messages.
   */
  async listenToMessages() {
    var binded = this.didReceiveMessageBinded.bind(this);
    this.state.chatContract.events
      .messageSentEvent({})
      .on("data", binded)
      .on("error", console.error);
  }

  /**
   * Listens for `etherSentEvent` to handle Ether transfer events.
   */
  async listenToEther() {
    var binded = this.didReceiveEtherBinded.bind(this);
    this.state.chatContract.events
      .etherSentEvent({})
      .on("data", binded)
      .on("error", console.error);
  }

  /**
   * Listens for `etherAskEvent` to handle Ether request events.
   */
  async listenToAskEther() {
    var binded = this.didReceiveAskEtherBinded.bind(this);
    this.state.chatContract.events
      .etherAskEvent({})
      .on("data", binded)
      .on("error", console.error);
  }

  /**
   * Listens for `messagesFetchedEvent` to handle fetching all messages.
   */
  async listenToFetchAllMsg() {
    var binded = this.didReceiveAllMsgBinded.bind(this);
    this.state.chatContract.events
      .messagesFetchedEvent({})
      .on("data", binded)
      .on("error", console.error);
  }

  // ------- Event Handlers ------

  /**
   * Handles received messages and updates the chat state.
   * @param {object} event - Blockchain event containing the message.
   */
  async didReceiveMessageBinded(event) {
    const message = event.returnValues.message;
    if (event.returnValues.from === this.state.account) {
      this.didReceiveMessage(message, true);
    }
    if (event.returnValues.to === this.state.account) {
      this.didReceiveMessage(message, false);
    }
    this.setState({
      didATransaction: false,
      didARequest: false,
    });
    await this.updateUIData();
  }

  /**
   * Handles Ether transfer events and updates the transaction state.
   * @param {object} event - Blockchain event for Ether transfer.
   */
  async didReceiveEtherBinded(event) {
    this.setState({
      didATransaction: true,
      didARequest: false,
      isLastTransactionSuccess: event.returnValues.success,
    });
    // await this.wait()
    await this.updateUIData();
  }

  /**
   * Handles Ether request events and updates the request state.
   * @param {object} event - Blockchain event for Ether request.
   */
  async didReceiveAskEtherBinded(event) {
    if (this.state.account === event.returnValues.to) {
      let value_as_wei = window.web3.utils.fromWei(
        event.returnValues.value,
        "ether"
      );

      this.setState({
        didATransaction: false,
        didARequest: true,
        accountRequesting: event.returnValues.from,
        accountRequested: event.returnValues.to,
        valueRequested: value_as_wei,
      });
      await this.updateUIData();
    }
  }

  /**
   * Handles fetching all messages and updates the chat state.
   * @param {object} event - Blockchain event containing messages.
   */
  async didReceiveAllMsgBinded(event) {
    let allMsg = [];

    event.returnValues.messages.forEach((message) => {
      allMsg.push({
        msg: message["message"],
        response: message["from"] === this.state.account,
      });
    });
    if (allMsg.length === 0) allMsg = this.state.fixedChats;

    this.setState({
      chats: allMsg,
    });
    await this.updateUIData();
  }

  /**
   *  Handles received messages and updates the chat state.
   * @param {*} message  The message received from the blockchain
   * @param {*} isResponse  True if the message is a response, false otherwise
   */
  async didReceiveMessage(message, isResponse) {
    let chats = this.state.chats;
    chats.push({
      msg: message,
      response: isResponse,
    });
    this.setState({
      chats: chats,
      inputValue: "",
    });
  }

  /**
   *  Sends a message to the blockchain
   * @param {*} message  The message to send
   */
  async didSendMessage(message) {
    // sendMsg(to, message)
    this.state.chatContract.methods
      .sendMsg(this.state.otherAccount, message)
      .send({ from: this.state.account, gas: 1500000 });
    await this.sendEtherIfAsked();
    await this.askEtherIfAsked();
  }

  /**
   *  Sends Ether to the blockchain
   * @returns  True if the message was sent, false otherwise
   */
  async sendEtherIfAsked() {
    let splitted = this.state.inputValue.split(":");
    if (splitted.length !== 2) return false;

    if (splitted[0] == "send_ether" && this.isNumeric(splitted[1])) {
      let asWei = parseFloat(splitted[1]) * 1e18;
      this.state.chatContract.methods.sendEther(this.state.otherAccount).send({
        from: this.state.account,
        value: asWei,
      });
      return true;
    }
    return false;
  }

  /**
   *  Asks for Ether to the blockchain
   * @returns  True if the message was sent, false otherwise
   */
  async askEtherIfAsked() {
    let splitted = this.state.inputValue.split(":");
    if (splitted.length !== 2) return false;

    if (splitted[0] == "ask_ether" && this.isNumeric(splitted[1])) {
      var asWei = (parseFloat(splitted[1]) * 1e18).toString();
      this.state.chatContract.methods
        .askEther(this.state.otherAccount, asWei)
        .send({ from: this.state.account });
      return true;
    }
    return false;
  }

  /**
   * Fetches all messages from the blockchain
   */
  async fetchAllMsg() {
    await this.state.chatContract.methods
      .getAllMsg(this.state.otherAccount)
      .send({ from: this.state.account });
  }

  // ------- UI state updaters ------
  /**
   * Updates the UI data by fetching the number of transactions, balances, blocks, and last gas.
   */
  async updateUIData() {
    await this.updateNbTransactions();
    await this.updateBalances();
    await this.updateBlocks();
    await this.updateLastGas();
  }

  /**
   *  Updates the input value
   * @param {*} evt  The event that triggered the update
   */
  updateInputValue(evt) {
    this.setState({
      inputValue: evt.target.value,
    });
  }

  /**
   *  Updates the selected address
   * @param {*} newValue  The new value to select
   * @param {*} isOtherAccount  True if the address is the other account, false otherwise
   */
  async updateAddressSelect(newValue, isOtherAccount) {
    if (isOtherAccount) {
      this.setState({
        otherAccount: newValue,
        chats: this.state.fixedChats,
      });
    } else {
      this.setState({
        account: newValue,
        chats: this.state.fixedChats,
      });
    }
    await this.wait();
    await this.fetchAllMsg();
    await this.updateUIData();
  }

  /**
   *  Updates the number of transactions
   */
  async updateNbTransactions() {
    let accountNbTransactions = await window.web3.eth.getTransactionCount(
      this.state.account
    );
    let otherAccountNbTransactions = await window.web3.eth.getTransactionCount(
      this.state.otherAccount
    );
    this.setState({
      accountNbTransactions: accountNbTransactions,
      otherAccountNbTransactions: otherAccountNbTransactions,
    });
  }

  /**
   * Updates the balances
   */
  async updateBalances() {
    let accountBalance = await window.web3.eth.getBalance(this.state.account);
    let otherAccountBalance = await window.web3.eth.getBalance(
      this.state.otherAccount
    );
    this.setState({
      accountBalance: window.web3.utils.fromWei(accountBalance, "ether"),
      otherAccountBalance: window.web3.utils.fromWei(
        otherAccountBalance,
        "ether"
      ),
    });
  }

  /**
   * Updates the number of blocks
   */
  async updateBlocks() {
    const latest = await window.web3.eth.getBlockNumber();
    this.setState({
      nbBlocks: latest,
    });
  }

  /**
   * Updates the last gas
   */
  async updateLastGas() {
    const lastBlockNumber = await window.web3.eth.getBlockNumber();
    let block = await window.web3.eth.getBlock(lastBlockNumber);
    block = await window.web3.eth.getBlock(lastBlockNumber);

    const lastTransaction = block.transactions[block.transactions.length - 1];
    const transaction = await window.web3.eth.getTransaction(lastTransaction);

    this.setState({
      blockHash: transaction["blockHash"],
      lastGas: transaction["gas"],
    });
  }

  // ------- UI ------
  /**
   *  Gets the chat messages as divs
   * @returns The chat messages as divs
   */
  getMessagesAsDivs() {
    let chatDivs = this.state.chats.map((x) =>
      x.response ? (
        <div class="message text-only">
          <div class="response">
            <p class="text"> {x.msg} </p>
          </div>
        </div>
      ) : (
        <div class="message text-only">
          <p class="text"> {x.msg} </p>
        </div>
      )
    );
    return chatDivs.reverse();
  }

  /**
   *  Gets the toggle addresses
   * @param {*} isOtherAccount  True if the address is the other account, false otherwise
   * @returns  The toggle addresses
   */
  getToggleAdresses(isOtherAccount) {
    var addresses = [];
    for (var i = 0; i < this.state.accounts.length; i++) {
      let account = this.state.accounts[i];
      if (
        (isOtherAccount && account == this.state.otherAccount) ||
        (!isOtherAccount && account == this.state.account)
      )
        addresses.push(
          <option value={account} selected>
            {account}
          </option>
        );
      else {
        addresses.push(<option value={account}>{account}</option>);
      }
    }
    return addresses;
  }

  /**
   *  Displays the ether transaction status
   * @returns The ether transaction status
   */
  displayEtherTransactionStatus() {
    if (!this.state.didATransaction) return;

    if (this.state.isLastTransactionSuccess)
      return <div style={{ color: "green" }}>ETH transaction succeeded!</div>;
    else return <div>error</div>;
  }

  /**
   *  Displays the
   * @returns The ask ether pop up
   */
  displayAskEtherPopUp() {
    let to = this.state.accountRequested;
    let valueAsEther = this.state.valueRequested;
    let valueAsWei = parseFloat(this.state.valueRequested) * 1e18;

    if (this.state.didARequest && to === this.state.account) {
      return (
        <div className="didAskContainer">
          <h6>Ether request</h6>
          <p>
            Account {to} requests you {valueAsEther} ether.
          </p>

          <button
            class="btn btn-success send-btn"
            onClick={() =>
              this.state.chatContract.methods
                .sendEther(this.state.accountRequesting)
                .send({
                  from: to,
                  value: valueAsWei,
                })
            }
          >
            Accept
          </button>
        </div>
      );
    }
    return;
  }

  // ------- helpers ------
  /**
   *  Checks if a string is numeric
   * @param {*} str  The string to check
   * @returns  True if the string is numeric, false otherwise
   */
  isNumeric(str) {
    if (typeof str != "string") return false;
    return !isNaN(str) && !isNaN(parseFloat(str));
  }

  /**
   * Waits for a certain amount of time
   */
  async wait() {
    const noop = () => {};
    for (var i = 0; i < 10000; i++) noop();
  }

  // ------- rendering ------
  /**
   *  Renders the component
   * @returns The rendered component
   */
  render() {
    return (
      <body>
        <div class="block-container">
          <div class="row">
            <div class="col-7 left-block">
              <section class="chat">
                <div class="header-chat">
                  <div class="left">
                    <img src={mainLogo} class="arrow" />
                    <select
                      class="custom-select"
                      onChange={(e) =>
                        this.updateAddressSelect(e.target.value, false)
                      }
                    >
                      {this.getToggleAdresses(false)}
                    </select>
                  </div>
                  <div class="right">
                    <select
                      class="custom-select"
                      onChange={(e) =>
                        this.updateAddressSelect(e.target.value, true)
                      }
                    >
                      {this.getToggleAdresses(true)}
                    </select>
                  </div>
                </div>
                <div class="messages-chat">{this.getMessagesAsDivs()}</div>
              </section>
              <div class="footer-chat">
                <i
                  class="icon fa fa-smile-o clickable"
                  style={{ fontSize: "25pt" }}
                  aria-hidden="true"
                ></i>
                <input
                  value={this.state.inputValue}
                  onChange={(evt) => this.updateInputValue(evt)}
                  type="text"
                  class="write-message"
                  placeholder="Type your message here"
                ></input>
                <i
                  class="icon send fa fa-paper-plane-o clickable"
                  aria-hidden="true"
                ></i>
                <button
                  class="btn btn-success send-btn"
                  onClick={() => this.didSendMessage(this.state.inputValue)}
                >
                  Send
                </button>
              </div>
            </div>
            <div class="col-5 right-block">
              <h3>Blockchain state</h3>
              <p>Number of blocks: {this.state.nbBlocks}</p>
              <p>Last transaction gas: {this.state.lastGas}</p>
              <div class="sender-block blockchain-block">
                <p>
                  <b>Sender address:</b>
                </p>
                <p>{this.state.account}</p>
                <p>
                  Number of transactions: {this.state.accountNbTransactions}
                </p>
                <p>Wallet balance: {this.state.accountBalance} ETH</p>
              </div>
              <div class="recip-block blockchain-block">
                <p>
                  <b>Recipient address:</b>
                </p>
                <p>{this.state.otherAccount}</p>
                <p>
                  Number of transactions:{" "}
                  {this.state.otherAccountNbTransactions}
                </p>
                <p>Wallet balance: {this.state.otherAccountBalance} ETH</p>
              </div>

              <div class="alert-transac">
                {this.displayEtherTransactionStatus()}
              </div>
              <div class="alert-request">{this.displayAskEtherPopUp()}</div>
            </div>
          </div>
        </div>
      </body>
    );
  }
}

export default Chat;
