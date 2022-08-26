const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TimeLock", function () {
  async function deployLockFixture() {

    const [owner, caller] = await ethers.getSigners();

    const Lock = await ethers.getContractFactory("TimeLock");
    const lock = await Lock.deploy(95, {value: 10000000});

    const Token = await ethers.getContractFactory("Token");
    const token = await Token.deploy();

    return { lock, token, owner, caller };
  }

  describe("Initialization: ", function() {
    it("Should init with correct args: ", async function () {
        const { lock, token, owner, caller } = await loadFixture(deployLockFixture);

        expect(await lock.ownerFee()).to.equal(ethers.BigNumber.from("95"));
        
    });
  });

  describe("locking amount: ", function() {
    it("Should lock with correct args when get only token", async function () {
        const { lock, token, owner, caller } = await loadFixture(deployLockFixture);

        const tokenAmount = ethers.BigNumber.from("1000");
        const time = ethers.BigNumber.from("100");

        await token.mint(caller.address, tokenAmount);
        await token.connect(caller).approve(lock.address, tokenAmount);
        
        const blockNumBefore = await ethers.provider.getBlockNumber();
        const blockBefore = await ethers.provider.getBlock(blockNumBefore);
        const timestampBefore = blockBefore.timestamp + 1;

        await lock.connect(caller).lock(tokenAmount, time, token.address);
        
        const locked = await lock.locks(caller.address, 0);

        expect(locked.amountEth).to.equal(0);
        expect(locked.amountToken).to.equal(tokenAmount);
        expect(locked.token).to.equal(token.address);
        expect(locked.lockTime).to.equal(timestampBefore);
        expect(locked.unlockTime).to.equal(time.add(timestampBefore));
        expect(locked.status).to.equal(1);
    });

    it("Should lock with correct args when get only ether", async function () {
      const { lock, token, owner, caller } = await loadFixture(deployLockFixture);

        const tokenAmount = ethers.BigNumber.from("0");
        const ethAmount = ethers.BigNumber.from("1000");
        const time = ethers.BigNumber.from("100");

        await lock.connect(caller).getEther(ethAmount);
        
        const blockNumBefore = await ethers.provider.getBlockNumber();
        const blockBefore = await ethers.provider.getBlock(blockNumBefore);
        const timestampBefore = blockBefore.timestamp + 1;
        
        await lock.connect(caller).lock(tokenAmount, time, token.address, {value: ethAmount});
        
        const locked = await lock.locks(caller.address, 0);

        expect(locked.amountEth).to.equal(ethAmount);
        expect(locked.amountToken).to.equal(tokenAmount);
        expect(locked.token).to.equal(token.address);
        expect(locked.lockTime).to.equal(timestampBefore);
        expect(locked.unlockTime).to.equal(time.add(timestampBefore));
        expect(locked.status).to.equal(1);
    });

    it("Should lock with correct args when get both", async function () {
      const { lock, token, owner, caller } = await loadFixture(deployLockFixture);

        const tokenAmount = ethers.BigNumber.from("1000");
        const ethAmount = ethers.BigNumber.from("1000");
        const time = ethers.BigNumber.from("100");

        await token.mint(caller.address, tokenAmount);
        await token.connect(caller).approve(lock.address, tokenAmount);
        await lock.connect(caller).getEther(ethAmount);
        
        const blockNumBefore = await ethers.provider.getBlockNumber();
        const blockBefore = await ethers.provider.getBlock(blockNumBefore);
        const timestampBefore = blockBefore.timestamp + 1;
        
        await lock.connect(caller).lock(tokenAmount, time, token.address, {value: ethAmount});
        
        const locked = await lock.locks(caller.address, 0);

        expect(locked.amountEth).to.equal(ethAmount);
        expect(locked.amountToken).to.equal(tokenAmount);
        expect(locked.token).to.equal(token.address);
        expect(locked.lockTime).to.equal(timestampBefore);
        expect(locked.unlockTime).to.equal(time.add(timestampBefore));
        expect(locked.status).to.equal(1);
    });

    it("Should lock second time with correct args", async function () {
      const { lock, token, owner, caller } = await loadFixture(deployLockFixture);

        const tokenAmount = ethers.BigNumber.from("1000");
        const ethAmount = ethers.BigNumber.from("1000");
        const time = ethers.BigNumber.from("100");

        await token.mint(caller.address, 2*tokenAmount);
        await token.connect(caller).approve(lock.address, 2*tokenAmount);
        await lock.connect(caller).getEther(2*ethAmount);

        await lock.connect(caller).lock(tokenAmount, time, token.address, {value: ethAmount});
        
        const blockNumBefore = await ethers.provider.getBlockNumber();
        const blockBefore = await ethers.provider.getBlock(blockNumBefore);
        const timestampBefore = blockBefore.timestamp + 1;
        
        await lock.connect(caller).lock(tokenAmount, time, token.address, {value: ethAmount});
        
        const locked = await lock.locks(caller.address, 1);

        expect(locked.amountEth).to.equal(ethAmount);
        expect(locked.amountToken).to.equal(tokenAmount);
        expect(locked.token).to.equal(token.address);
        expect(locked.lockTime).to.equal(timestampBefore);
        expect(locked.unlockTime).to.equal(time.add(timestampBefore));
        expect(locked.status).to.equal(1);
    });

    it("Should transfer correct amount", async function () {
      const { lock, token, owner, caller } = await loadFixture(deployLockFixture);

        const tokenAmount = ethers.BigNumber.from("1000");
        const ethAmount = ethers.BigNumber.from("1000");
        const time = ethers.BigNumber.from("100");

        await token.mint(caller.address, tokenAmount);
        await token.connect(caller).approve(lock.address, tokenAmount);
        await lock.connect(caller).getEther(ethAmount);

        await expect(lock.connect(caller).lock(tokenAmount, time, token.address)).to.changeTokenBalances(token, [lock, caller], [tokenAmount, 0 - tokenAmount]);

        await expect(lock.connect(caller).lock(0, time, token.address, {value: ethAmount})).to.changeEtherBalances([lock, caller], [ethAmount, 0 - ethAmount]);
    });

    it("Should fail if not enough funds", async function () {
      const { lock, token, owner, caller } = await loadFixture(deployLockFixture);

      const tokenAmount = ethers.BigNumber.from("1000");
      const time = ethers.BigNumber.from("100");
      
      await token.connect(caller).approve(lock.address, tokenAmount);


      await expect(lock.connect(caller).lock(tokenAmount, time, token.address)).to.be.revertedWith("Lock: Not enough funds");
    });

    it("Should fail if not enough allowance", async function () {
      const { lock, token, owner, caller } = await loadFixture(deployLockFixture);
      
      const tokenAmount = ethers.BigNumber.from("1000");
      const time = ethers.BigNumber.from("100");

      await token.mint(caller.address, tokenAmount);

      await expect(lock.connect(caller).lock(tokenAmount, time, token.address)).to.be.revertedWith("Lock: Not enough allowance");
    });

    it("Should emit Locked event", async function () {
      const { lock, token, owner, caller } = await loadFixture(deployLockFixture);
      
      const tokenAmount = ethers.BigNumber.from("1000");
      const ethAmount = ethers.BigNumber.from("1000");
      const time = ethers.BigNumber.from("100");

      await token.mint(caller.address, tokenAmount);
      await token.connect(caller).approve(lock.address, tokenAmount);
      await lock.connect(caller).getEther(ethAmount);

      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const timestampBefore = blockBefore.timestamp + 1;
      
      await expect(lock.connect(caller).lock(tokenAmount, time, token.address, {value: ethAmount})).to.emit(lock, 'Locked').withArgs(
        caller.address, 
        token.address, 
        tokenAmount,
        ethAmount,
        time,
        time.add(timestampBefore)
      );
    });
  });

  describe("unlocking amount: ", function() {
    it("Should unlock with correct args", async function () {
        const { lock, token, owner, caller } = await loadFixture(deployLockFixture);

        const tokenAmount = ethers.BigNumber.from("1000");
        const ethAmount = ethers.BigNumber.from("1000");
        const time = ethers.BigNumber.from("1");

        await token.mint(caller.address, 2*tokenAmount);
        await token.connect(caller).approve(lock.address, 2*tokenAmount);
        await lock.connect(caller).getEther(2*ethAmount);

        await lock.connect(caller).lock(tokenAmount, time, token.address);
        await lock.connect(caller).lock(tokenAmount, time, token.address, {value: ethAmount});

        await lock.connect(caller).unlock(1);
        
        const _ownerFee = 100 - await lock.ownerFee();
        expect(await lock.ownerProfitEther()).to.equal(ethAmount * _ownerFee / 100);
        expect(await lock.ownerProfitToken(token.address)).to.equal(tokenAmount * _ownerFee / 100);

        const locked = await lock.locks(caller.address, 1);

        expect(locked.amountEth).to.equal(0);
        expect(locked.amountToken).to.equal(0);
        expect(locked.token).to.equal("0x0000000000000000000000000000000000000000");
        expect(locked.lockTime).to.equal(0);
        expect(locked.unlockTime).to.equal(0);
        expect(locked.status).to.equal(0);
    });

    it("Should transfer correct amount", async function () {
      const { lock, token, owner, caller } = await loadFixture(deployLockFixture);

        const tokenAmount = ethers.BigNumber.from("1000");
        const ethAmount = ethers.BigNumber.from("1000");
        const time = ethers.BigNumber.from("1");
        
        await token.mint(caller.address, tokenAmount);
        await token.connect(caller).approve(lock.address, tokenAmount);
        await lock.connect(caller).getEther(ethAmount);

        await lock.connect(caller).lock(tokenAmount, time, token.address);
        await lock.connect(caller).lock(0, time, token.address, {value: ethAmount});

        const _ownerFee = await lock.ownerFee();
        
        const _tokenAmount = tokenAmount * _ownerFee / 100;
        const _ethAmount = ethAmount * _ownerFee / 100;

        await expect(lock.connect(caller).unlock(0)).to.changeTokenBalances(token, [lock, caller], [0 - _tokenAmount, _tokenAmount]);

        await expect(lock.connect(caller).unlock(1)).to.changeEtherBalances([lock, caller], [0 - _ethAmount, _ethAmount]);
    });

    it("Should fail if wrong lock number", async function () {
      const { lock, token, owner, caller } = await loadFixture(deployLockFixture);
      
      const tokenAmount = ethers.BigNumber.from("1000");
      const time = ethers.BigNumber.from("1");
      
      await token.mint(caller.address, tokenAmount);
      await token.connect(caller).approve(lock.address, tokenAmount);

      await lock.connect(caller).lock(tokenAmount, time, token.address);

      await expect(lock.connect(caller).unlock(1)).to.be.revertedWith("Lock: Wrong lock number");
    });

    it("Should fail if amount is still locked", async function () {
      const { lock, token, owner, caller } = await loadFixture(deployLockFixture);
      
      const tokenAmount = ethers.BigNumber.from("1000");
      const time = ethers.BigNumber.from("100");
      
      await token.mint(caller.address, tokenAmount);
      await token.connect(caller).approve(lock.address, tokenAmount);

      await lock.connect(caller).lock(tokenAmount, time, token.address);

      await expect(lock.connect(caller).unlock(0)).to.be.revertedWith("Lock: Amount is still locked");
    });

    it("Should fail if not enough funds", async function () {
      const { lock, token, owner, caller } = await loadFixture(deployLockFixture);
      
      const tokenAmount = ethers.BigNumber.from("0");
      const time = ethers.BigNumber.from("1");
      
      await token.mint(caller.address, tokenAmount);
      await token.connect(caller).approve(lock.address, tokenAmount);

      await lock.connect(caller).lock(tokenAmount, time, token.address);

      await expect(lock.connect(caller).unlock(0)).to.be.revertedWith("Lock: Not enough funds");
    });
  });

  describe("withdraw: ", function() {
    it("Should transfer correct amount", async function () {
      const { lock, token, owner, caller } = await loadFixture(deployLockFixture);

        const tokenAmount = ethers.BigNumber.from("1000");
        const ethAmount = ethers.BigNumber.from("1000");
        const time = ethers.BigNumber.from("1");
        
        await token.mint(caller.address, tokenAmount);
        await token.connect(caller).approve(lock.address, tokenAmount);
        await lock.connect(caller).getEther(ethAmount);

        await lock.connect(caller).lock(tokenAmount, time, token.address, {value: ethAmount});
        await lock.connect(caller).unlock(0);

        const _ownerFee = 100 - await lock.ownerFee();
        
        const _tokenAmount = tokenAmount * _ownerFee / 100;
        const _ethAmount = ethAmount * _ownerFee / 100;

        await expect(lock.withdraw(0, _tokenAmount, token.address)).to.changeTokenBalances(token, [lock, owner], [0 - _tokenAmount, _tokenAmount]);
        expect(await lock.ownerProfitToken(token.address)).to.equal(0);

        await expect(lock.withdraw(_ethAmount, 0, token.address)).to.changeEtherBalances([lock, owner], [0 - _ethAmount, _ethAmount]);
        expect(await lock.ownerProfitEther()).to.equal(0);
    });

    it("Should fail if not enought ether", async function () {
      const { lock, token, owner, caller } = await loadFixture(deployLockFixture);

        const tokenAmount = ethers.BigNumber.from("1000");
        const ethAmount = ethers.BigNumber.from("1000");
        const time = ethers.BigNumber.from("1");
        
        await token.mint(caller.address, tokenAmount);
        await token.connect(caller).approve(lock.address, tokenAmount);
        await lock.connect(caller).getEther(ethAmount);

        await lock.connect(caller).lock(tokenAmount, time, token.address, {value: ethAmount});
        await lock.connect(caller).unlock(0);

        await expect(lock.withdraw(ethAmount, 0, token.address)).to.be.revertedWith("Lock: Not enought ether");
    });

    it("Should fail if not enought token", async function () {
      const { lock, token, owner, caller } = await loadFixture(deployLockFixture);

        const tokenAmount = ethers.BigNumber.from("1000");
        const ethAmount = ethers.BigNumber.from("1000");
        const time = ethers.BigNumber.from("1");

        await lock.connect(caller).getEther(ethAmount);

        await lock.connect(caller).lock(0, time, token.address, {value: ethAmount});
        await lock.connect(caller).unlock(0);

        const _ownerFee = 100 - await lock.ownerFee();

        const _ethAmount = ethAmount * _ownerFee / 100;

        await expect(lock.withdraw(_ethAmount, tokenAmount, token.address)).to.be.revertedWith("Lock: Not enought token");
    });
  });
});