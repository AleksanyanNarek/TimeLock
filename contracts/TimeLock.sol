// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TimeLock is Ownable {
    enum Status {UNLOCK, LOCK}

    struct User {
        uint256 amountEth;
        uint256 amountToken;
        //mapping (uint256 => address) tokens;
        address token;
        uint256 lockTime;
        uint256 unlockTime;
        Status status;
    }

    uint256 public ownerFee;

    uint256 public ownerProfitEther;
    mapping(address => uint256) public ownerProfitToken;

    mapping(address => mapping(uint256 => User)) public locks;
    mapping(address => uint256) public lockCount;

    event Locked(
        address indexed user,
        address indexed token,
        uint256 tokenAmount,
        uint256 ethAmount,
        uint256 lockTime,
        uint256 unlockTime
    );

    constructor(uint256 _ownerFee) payable {
        ownerFee = _ownerFee;
    }

    function lock(
        uint256 _tokenAmount,
        uint256 _lockTime,
        address _token
        //address[] memory _tokens,
    ) external payable {
        //require(locks[msg.sender].status == Status.UNLOCK, "Lock: you already locked your amount");

        // for(uint256 i = 0; i < _tokens.length; i++) {
        //     require(IERC20(_tokens[i]).balanceOf(msg.sender) >= _tokenAmount, "Lock: Not enough funds");
        //     require(IERC20(_tokens[i]).allowance(msg.sender, address(this)) >= _tokenAmount, "Lock: Not enough allowance");
        //     IERC20(_tokens[i]).transferFrom( msg.sender, address(this), _tokenAmount );
        // }

        require(IERC20(_token).balanceOf(msg.sender) >= _tokenAmount, "Lock: Not enough funds");
        require(IERC20(_token).allowance(msg.sender, address(this)) >= _tokenAmount, "Lock: Not enough allowance");
        IERC20(_token).transferFrom( msg.sender, address(this), _tokenAmount );
        
        locks[msg.sender][lockCount[msg.sender]] = User(
            msg.value,
            _tokenAmount,
            _token,
            block.timestamp,
            block.timestamp + _lockTime,
            Status.LOCK
        );

        lockCount[msg.sender]++;

        emit Locked(
            msg.sender,
            _token,
            _tokenAmount,
            msg.value,
            _lockTime,
            block.timestamp + _lockTime
        );

    }

    function getEther(uint256 amount) public {
        payable(msg.sender).transfer(amount);
    }


    function unlock(uint256 lockNumber) external {

        require(locks[msg.sender][lockNumber].status == Status.LOCK, "Lock: Wrong lock number");
        require(block.timestamp >= locks[msg.sender][lockNumber].unlockTime, "Lock: Amount is still locked");
        require(locks[msg.sender][lockNumber].amountEth > 0 || locks[msg.sender][lockNumber].amountToken > 0, "Lock: Not enough funds");

        uint256 ethAmount = locks[msg.sender][lockNumber].amountEth;
        locks[msg.sender][lockNumber].amountEth = 0;

        uint256 tokenAmount = locks[msg.sender][lockNumber].amountToken;
        locks[msg.sender][lockNumber].amountToken = 0;

        payable(msg.sender).transfer(ethAmount * ownerFee / 100);
        ownerProfitEther += ethAmount * (100-ownerFee) / 100;

        IERC20(locks[msg.sender][lockNumber].token).transfer(msg.sender, tokenAmount * ownerFee / 100);
        ownerProfitToken[locks[msg.sender][lockNumber].token] += tokenAmount * (100-ownerFee) / 100;
        
        // for(uint256 i = 0; i < locks[msg.sender][lockNumber].tokens.length; i++) {
        //     IERC20(locks[msg.sender][lockNumber].tokens[i]).transfer(msg.sender, tokenAmount * ownerFee / 100);
        //     ownerProfitToken[locks[msg.sender][lockNumber].token[i]] += tokenAmount * (100-ownerFee) / 100;

        // }
     
        locks[msg.sender][lockNumber].amountToken = 0;
        locks[msg.sender][lockNumber].amountEth = 0;
        locks[msg.sender][lockNumber].token = address(0);
        locks[msg.sender][lockNumber].lockTime = 0;
        locks[msg.sender][lockNumber].unlockTime = 0;
        locks[msg.sender][lockNumber].status = Status.UNLOCK;
    }

    function withdraw(uint256 amountEth, uint256 amountToken, address token) external onlyOwner{
        require(ownerProfitEther >= amountEth, "Lock: Not enought ether");
        require(ownerProfitToken[token] >= amountToken, "Lock: Not enought token");

        ownerProfitEther -= amountEth;
        payable(msg.sender).transfer(amountEth);
        ownerProfitToken[token] -= amountToken;
        IERC20(token).transfer(msg.sender, amountToken);
    }
}

